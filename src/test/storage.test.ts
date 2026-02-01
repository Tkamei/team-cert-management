import { JSONStorage } from '../data/storage';
import { UsersData, CertificationsData } from '../types';
import * as fs from 'fs/promises';

describe('JSONStorage', () => {
  const testDataDir = './test-data-storage';
  let storage: JSONStorage;

  beforeEach(() => {
    storage = new JSONStorage(testDataDir);
  });

  describe('initializeDataDirectory', () => {
    it('should create data directory and initialize JSON files', async () => {
      await storage.initializeDataDirectory();

      // ディレクトリが作成されることを確認
      const stats = await fs.stat(testDataDir);
      expect(stats.isDirectory()).toBe(true);

      // JSONファイルが作成されることを確認
      const usersData = await storage.readUsers();
      expect(usersData).toEqual({ users: [] });

      const certificationsData = await storage.readCertifications();
      expect(certificationsData).toEqual({ certifications: [] });
    });
  });

  describe('readFile and writeFile', () => {
    beforeEach(async () => {
      await storage.initializeDataDirectory();
    });

    it('should write and read users data', async () => {
      const testData: UsersData = {
        users: [
          {
            id: 'test-id',
            email: 'test@example.com',
            name: 'Test User',
            role: 'member' as any,
            passwordHash: 'hashed-password',
            requiresPasswordChange: true,
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z'
          }
        ]
      };

      await storage.writeUsers(testData);
      const readData = await storage.readUsers();

      expect(readData).toEqual(testData);
    });

    it('should write and read certifications data', async () => {
      const testData: CertificationsData = {
        certifications: [
          {
            id: 'cert-id',
            name: 'Test Certification',
            issuer: 'Test Issuer',
            category: 'cloud' as any,
            difficulty: 3,
            description: 'Test description',
            validityPeriod: 36,
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z'
          }
        ]
      };

      await storage.writeCertifications(testData);
      const readData = await storage.readCertifications();

      expect(readData).toEqual(testData);
    });
  });

  describe('backup and restore', () => {
    const testBackupDir = './test-backups';

    beforeEach(async () => {
      await storage.initializeDataDirectory();
    });

    afterEach(async () => {
      try {
        await fs.rm(testBackupDir, { recursive: true, force: true });
      } catch (error) {
        // バックアップディレクトリが存在しない場合は無視
      }
    });

    it('should create backup and restore from it', async () => {
      // テストデータを作成
      const testUsersData: UsersData = {
        users: [
          {
            id: 'backup-test-id',
            email: 'backup@example.com',
            name: 'Backup User',
            role: 'admin' as any,
            passwordHash: 'backup-hash',
            requiresPasswordChange: false,
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z'
          }
        ]
      };

      await storage.writeUsers(testUsersData);

      // バックアップを作成
      const backupPath = await storage.createBackup(testBackupDir);
      expect(backupPath).toMatch(/test-backups/);
      expect(backupPath).toMatch(/backup-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z/);

      // データを変更
      const modifiedData: UsersData = { users: [] };
      await storage.writeUsers(modifiedData);

      // 変更されたことを確認
      const modifiedReadData = await storage.readUsers();
      expect(modifiedReadData.users).toHaveLength(0);

      // バックアップから復旧
      await storage.restoreFromBackup(backupPath);

      // 元のデータが復旧されたことを確認
      const restoredData = await storage.readUsers();
      expect(restoredData).toEqual(testUsersData);
    });
  });
});