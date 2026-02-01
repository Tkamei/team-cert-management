import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join } from 'path';
import cron from 'node-cron';
import { db } from '@/database/config';
import { logger } from '@/utils/logger';

const execAsync = promisify(exec);

export interface BackupMetadata {
  id: string;
  backupName: string;
  backupPath: string;
  backupSize?: number;
  backupType: 'full' | 'incremental';
  status: 'in_progress' | 'completed' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  errorMessage?: string;
}

export class BackupService {
  private backupPath: string;
  private retentionDays: number;
  private dbConfig: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
  };

  constructor() {
    this.backupPath = process.env.BACKUP_PATH || './backups';
    this.retentionDays = parseInt(process.env.BACKUP_RETENTION_DAYS || '30', 10);
    
    this.dbConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'team_certification_management',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password'
    };

    this.ensureBackupDirectory();
    this.scheduleBackups();
  }

  private ensureBackupDirectory(): void {
    if (!existsSync(this.backupPath)) {
      mkdirSync(this.backupPath, { recursive: true });
      logger.info(`Created backup directory: ${this.backupPath}`);
    }
  }

  private scheduleBackups(): void {
    const schedule = process.env.BACKUP_SCHEDULE || '0 2 * * *'; // Daily at 2 AM
    
    cron.schedule(schedule, async () => {
      logger.info('Starting scheduled backup');
      try {
        await this.createBackup();
        await this.cleanupOldBackups();
        logger.info('Scheduled backup completed successfully');
      } catch (error) {
        logger.error('Scheduled backup failed:', error);
      }
    });

    logger.info(`Backup scheduled with cron pattern: ${schedule}`);
  }

  public async createBackup(type: 'full' | 'incremental' = 'full'): Promise<BackupMetadata> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `backup_${type}_${timestamp}.sql`;
    const backupFilePath = join(this.backupPath, backupName);

    const metadata: BackupMetadata = {
      id: '', // Will be set after database insert
      backupName,
      backupPath: backupFilePath,
      backupType: type,
      status: 'in_progress',
      startedAt: new Date()
    };

    try {
      // Insert backup metadata into database
      const result = await db.query(`
        INSERT INTO backup_metadata (backup_name, backup_path, backup_type, status, started_at)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `, [metadata.backupName, metadata.backupPath, metadata.backupType, metadata.status, metadata.startedAt]);

      metadata.id = (result as { rows: { id: string }[] }).rows[0]?.id;

      // Create the backup using pg_dump
      const pgDumpCommand = this.buildPgDumpCommand(backupFilePath, type);
      logger.info(`Executing backup command: ${pgDumpCommand.replace(this.dbConfig.password, '***')}`);

      await execAsync(pgDumpCommand, {
        env: {
          ...process.env,
          PGPASSWORD: this.dbConfig.password
        }
      });

      // Get backup file size
      const stats = statSync(backupFilePath);
      metadata.backupSize = stats.size;
      metadata.completedAt = new Date();
      metadata.status = 'completed';

      // Update backup metadata in database
      await db.query(`
        UPDATE backup_metadata 
        SET backup_size = $1, status = $2, completed_at = $3
        WHERE id = $4
      `, [metadata.backupSize, metadata.status, metadata.completedAt, metadata.id]);

      logger.info(`Backup created successfully: ${backupName} (${metadata.backupSize} bytes)`);
      return metadata;

    } catch (error) {
      metadata.status = 'failed';
      metadata.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      metadata.completedAt = new Date();

      // Update backup metadata in database
      if (metadata.id) {
        await db.query(`
          UPDATE backup_metadata 
          SET status = $1, error_message = $2, completed_at = $3
          WHERE id = $4
        `, [metadata.status, metadata.errorMessage, metadata.completedAt, metadata.id]);
      }

      logger.error(`Backup failed: ${metadata.errorMessage}`);
      throw error;
    }
  }

  private buildPgDumpCommand(backupFilePath: string, type: 'full' | 'incremental'): string {
    let command = `pg_dump -h ${this.dbConfig.host} -p ${this.dbConfig.port} -U ${this.dbConfig.user} -d ${this.dbConfig.database}`;
    
    // Add options based on backup type
    if (type === 'full') {
      command += ' --verbose --clean --if-exists --create';
    } else {
      // For incremental, we'll do data-only backup
      command += ' --verbose --data-only --inserts';
    }

    command += ` --file="${backupFilePath}"`;
    
    return command;
  }

  public async restoreBackup(backupFilePath: string): Promise<void> {
    try {
      if (!existsSync(backupFilePath)) {
        throw new Error(`Backup file not found: ${backupFilePath}`);
      }

      logger.info(`Starting database restore from: ${backupFilePath}`);

      // Use psql to restore the backup
      const restoreCommand = `psql -h ${this.dbConfig.host} -p ${this.dbConfig.port} -U ${this.dbConfig.user} -d ${this.dbConfig.database} -f "${backupFilePath}"`;

      await execAsync(restoreCommand, {
        env: {
          ...process.env,
          PGPASSWORD: this.dbConfig.password
        }
      });

      logger.info('Database restore completed successfully');

    } catch (error) {
      logger.error('Database restore failed:', error);
      throw error;
    }
  }

  public async restoreFromLatestBackup(): Promise<void> {
    try {
      const latestBackup = await this.getLatestSuccessfulBackup();
      if (!latestBackup) {
        throw new Error('No successful backup found');
      }

      await this.restoreBackup(latestBackup.backupPath);
      logger.info(`Restored from latest backup: ${latestBackup.backupName}`);

    } catch (error) {
      logger.error('Failed to restore from latest backup:', error);
      throw error;
    }
  }

  private async getLatestSuccessfulBackup(): Promise<BackupMetadata | null> {
    try {
      const result = await db.query(`
        SELECT id, backup_name, backup_path, backup_size, backup_type, 
               status, started_at, completed_at, error_message
        FROM backup_metadata 
        WHERE status = 'completed' 
        ORDER BY completed_at DESC 
        LIMIT 1
      `);

      const rows = (result as { rows: unknown[] }).rows;
      if (rows.length === 0) {
        return null;
      }

      const row = rows[0] as {
        id: string;
        backup_name: string;
        backup_path: string;
        backup_size: number;
        backup_type: 'full' | 'incremental';
        status: 'completed';
        started_at: Date;
        completed_at: Date;
        error_message: string | null;
      };

      return {
        id: row.id,
        backupName: row.backup_name,
        backupPath: row.backup_path,
        backupSize: row.backup_size,
        backupType: row.backup_type,
        status: row.status,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        errorMessage: row.error_message || undefined
      };

    } catch (error) {
      logger.error('Failed to get latest backup:', error);
      return null;
    }
  }

  private async cleanupOldBackups(): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

      // Get old backups from database
      const result = await db.query(`
        SELECT id, backup_name, backup_path 
        FROM backup_metadata 
        WHERE created_at < $1
      `, [cutoffDate]);

      const oldBackups = (result as { rows: { id: string; backup_name: string; backup_path: string }[] }).rows;

      for (const backup of oldBackups) {
        try {
          // Delete physical file
          if (existsSync(backup.backup_path)) {
            unlinkSync(backup.backup_path);
            logger.info(`Deleted old backup file: ${backup.backup_name}`);
          }

          // Delete database record
          await db.query('DELETE FROM backup_metadata WHERE id = $1', [backup.id]);
          logger.info(`Removed old backup record: ${backup.backup_name}`);

        } catch (error) {
          logger.error(`Failed to cleanup backup ${backup.backup_name}:`, error);
        }
      }

      if (oldBackups.length > 0) {
        logger.info(`Cleaned up ${oldBackups.length} old backups`);
      }

    } catch (error) {
      logger.error('Failed to cleanup old backups:', error);
    }
  }

  public async listBackups(): Promise<BackupMetadata[]> {
    try {
      const result = await db.query(`
        SELECT id, backup_name, backup_path, backup_size, backup_type, 
               status, started_at, completed_at, error_message, created_at
        FROM backup_metadata 
        ORDER BY created_at DESC
      `);

      const rows = (result as { rows: unknown[] }).rows;
      return rows.map((row: unknown) => {
        const r = row as {
          id: string;
          backup_name: string;
          backup_path: string;
          backup_size: number | null;
          backup_type: 'full' | 'incremental';
          status: 'in_progress' | 'completed' | 'failed';
          started_at: Date;
          completed_at: Date | null;
          error_message: string | null;
        };

        return {
          id: r.id,
          backupName: r.backup_name,
          backupPath: r.backup_path,
          backupSize: r.backup_size || undefined,
          backupType: r.backup_type,
          status: r.status,
          startedAt: r.started_at,
          completedAt: r.completed_at || undefined,
          errorMessage: r.error_message || undefined
        };
      });

    } catch (error) {
      logger.error('Failed to list backups:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const backupService = new BackupService();