import { readFileSync } from 'fs';
import { join } from 'path';
import { db } from './config';

export class DatabaseMigrator {
  private static async executeSchemaFile(): Promise<void> {
    try {
      const schemaPath = join(__dirname, 'schema.sql');
      const schema = readFileSync(schemaPath, 'utf8');
      
      console.log('Executing database schema...');
      await db.query(schema);
      console.log('Database schema executed successfully');
    } catch (error) {
      console.error('Error executing database schema:', error);
      throw error;
    }
  }

  private static async createDefaultAdmin(): Promise<void> {
    try {
      // Check if admin user already exists
      const existingAdmin = await db.query(
        'SELECT id FROM users WHERE role = $1 LIMIT 1',
        ['admin']
      );

      if ((existingAdmin as { rows: unknown[] }).rows.length > 0) {
        console.log('Admin user already exists, skipping creation');
        return;
      }

      // Create default admin user
      const bcrypt = await import('bcryptjs');
      const defaultPassword = 'admin123'; // This should be changed on first login
      const hashedPassword = await bcrypt.hash(defaultPassword, 12);

      await db.query(`
        INSERT INTO users (email, name, password_hash, role, requires_password_change)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        'admin@example.com',
        'System Administrator',
        hashedPassword,
        'admin',
        true
      ]);

      console.log('Default admin user created:');
      console.log('  Email: admin@example.com');
      console.log('  Password: admin123');
      console.log('  Note: Please change the password on first login');
    } catch (error) {
      console.error('Error creating default admin user:', error);
      throw error;
    }
  }

  public static async migrate(): Promise<void> {
    try {
      console.log('Starting database migration...');
      
      // Test database connection
      const isConnected = await db.testConnection();
      if (!isConnected) {
        throw new Error('Cannot connect to database');
      }
      console.log('Database connection successful');

      // Execute schema
      await this.executeSchemaFile();

      // Create default admin user
      await this.createDefaultAdmin();

      console.log('Database migration completed successfully');
    } catch (error) {
      console.error('Database migration failed:', error);
      process.exit(1);
    }
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  DatabaseMigrator.migrate()
    .then(() => {
      console.log('Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}