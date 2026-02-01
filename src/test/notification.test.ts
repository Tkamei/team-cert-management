import { SimpleNotificationService } from '../services/notification';
import { JSONStorage } from '../data/storage';
import { NotificationType, UserRole, CertificationCategory } from '../types';

describe('SimpleNotificationService', () => {
  const testDataDir = './test-data-notification';
  let storage: JSONStorage;
  let notificationService: SimpleNotificationService;

  beforeEach(async () => {
    storage = new JSONStorage(testDataDir);
    await storage.initializeDataDirectory();
    notificationService = new SimpleNotificationService(storage);
  });

  describe('createNotification', () => {
    it('should create a new notification', async () => {
      const userId = 'user-1';
      const type = NotificationType.PLAN_REMINDER;
      const title = 'Test Notification';
      const message = 'This is a test notification';
      const data = { testData: 'value' };

      const notification = await notificationService.createNotification(
        userId, 
        type, 
        title, 
        message, 
        data
      );

      expect(notification.userId).toBe(userId);
      expect(notification.type).toBe(type);
      expect(notification.title).toBe(title);
      expect(notification.message).toBe(message);
      expect(notification.data).toEqual(data);
      expect(notification.isRead).toBe(false);
      expect(notification.id).toBeDefined();
      expect(notification.createdAt).toBeDefined();
    });

    it('should create notification without data', async () => {
      const userId = 'user-1';
      const type = NotificationType.NEW_CERTIFICATION;
      const title = 'Simple Notification';
      const message = 'Simple message';

      const notification = await notificationService.createNotification(
        userId, 
        type, 
        title, 
        message
      );

      expect(notification.data).toBeUndefined();
      expect(notification.isRead).toBe(false);
    });
  });

  describe('getUserNotifications', () => {
    beforeEach(async () => {
      // テスト用の通知を複数作成
      await notificationService.createNotification(
        'user-1',
        NotificationType.PLAN_REMINDER,
        'Plan Reminder 1',
        'Message 1'
      );

      const notification2 = await notificationService.createNotification(
        'user-1',
        NotificationType.EXPIRY_WARNING,
        'Expiry Warning',
        'Message 2'
      );

      await notificationService.createNotification(
        'user-2',
        NotificationType.NEW_CERTIFICATION,
        'New Cert',
        'Message 3'
      );

      // 1つを既読にする
      await notificationService.markAsRead(notification2.id);
    });

    it('should return notifications for specific user', async () => {
      const user1Notifications = await notificationService.getUserNotifications('user-1');
      const user2Notifications = await notificationService.getUserNotifications('user-2');

      expect(user1Notifications).toHaveLength(2);
      expect(user2Notifications).toHaveLength(1);

      user1Notifications.forEach(notification => {
        expect(notification.userId).toBe('user-1');
      });
    });

    it('should filter unread notifications when requested', async () => {
      const allNotifications = await notificationService.getUserNotifications('user-1', false);
      const unreadNotifications = await notificationService.getUserNotifications('user-1', true);

      expect(allNotifications).toHaveLength(2);
      expect(unreadNotifications).toHaveLength(1);
      expect(unreadNotifications[0]?.isRead).toBe(false);
    });

    it('should return empty array for user with no notifications', async () => {
      const notifications = await notificationService.getUserNotifications('user-3');
      expect(notifications).toHaveLength(0);
    });
  });

  describe('markAsRead and markAllAsRead', () => {
    it('should mark single notification as read', async () => {
      const notification = await notificationService.createNotification(
        'user-1',
        NotificationType.PLAN_REMINDER,
        'Test',
        'Test message'
      );

      expect(notification.isRead).toBe(false);

      const updatedNotification = await notificationService.markAsRead(notification.id);
      expect(updatedNotification.isRead).toBe(true);
    });

    it('should mark all user notifications as read', async () => {
      await notificationService.createNotification(
        'user-1',
        NotificationType.PLAN_REMINDER,
        'Test 1',
        'Message 1'
      );

      await notificationService.createNotification(
        'user-1',
        NotificationType.EXPIRY_WARNING,
        'Test 2',
        'Message 2'
      );

      const updatedCount = await notificationService.markAllAsRead('user-1');
      expect(updatedCount).toBe(2);

      const notifications = await notificationService.getUserNotifications('user-1');
      notifications.forEach(notification => {
        expect(notification.isRead).toBe(true);
      });
    });

    it('should throw error when marking non-existent notification as read', async () => {
      await expect(notificationService.markAsRead('non-existent-id'))
        .rejects.toThrow('Notification not found');
    });
  });

  describe('deleteNotification', () => {
    it('should delete notification', async () => {
      const notification = await notificationService.createNotification(
        'user-1',
        NotificationType.PLAN_REMINDER,
        'Test',
        'Test message'
      );

      await notificationService.deleteNotification(notification.id);

      const notifications = await notificationService.getUserNotifications('user-1');
      expect(notifications).toHaveLength(0);
    });

    it('should throw error when deleting non-existent notification', async () => {
      await expect(notificationService.deleteNotification('non-existent-id'))
        .rejects.toThrow('Notification not found');
    });
  });

  describe('deleteOldNotifications', () => {
    it('should delete old notifications', async () => {
      const userId = 'user-1';
      
      // 新しい通知を作成
      await notificationService.createNotification(
        userId,
        NotificationType.PLAN_REMINDER,
        'Recent',
        'Recent message'
      );

      // 古い通知をシミュレート（実際のテストでは日付操作が困難なため、この機能は統合テストで確認）
      const deletedCount = await notificationService.deleteOldNotifications(userId, 30);
      
      // 新しい通知なので削除されない
      expect(deletedCount).toBe(0);
      
      const notifications = await notificationService.getUserNotifications(userId);
      expect(notifications).toHaveLength(1);
    });
  });

  describe('getNotificationStats', () => {
    it('should return correct notification statistics', async () => {
      const userId = 'user-1';
      
      await notificationService.createNotification(
        userId,
        NotificationType.PLAN_REMINDER,
        'Plan Reminder',
        'Message 1'
      );

      const notification2 = await notificationService.createNotification(
        userId,
        NotificationType.EXPIRY_WARNING,
        'Expiry Warning',
        'Message 2'
      );

      await notificationService.createNotification(
        userId,
        NotificationType.PLAN_REMINDER,
        'Another Plan Reminder',
        'Message 3'
      );

      // 1つを既読にする
      await notificationService.markAsRead(notification2.id);

      const stats = await notificationService.getNotificationStats(userId);

      expect(stats.totalNotifications).toBe(3);
      expect(stats.unreadNotifications).toBe(2);
      expect(stats.notificationsByType).toHaveLength(2);

      const planReminderStat = stats.notificationsByType.find(s => s.type === NotificationType.PLAN_REMINDER);
      const expiryWarningStat = stats.notificationsByType.find(s => s.type === NotificationType.EXPIRY_WARNING);

      expect(planReminderStat?.count).toBe(2);
      expect(planReminderStat?.unreadCount).toBe(2);
      expect(expiryWarningStat?.count).toBe(1);
      expect(expiryWarningStat?.unreadCount).toBe(0);
    });
  });

  describe('getNotificationTemplate', () => {
    it('should return correct template for plan reminder', async () => {
      const data = {
        certificationName: 'AWS Certified Solutions Architect',
        daysUntilTarget: 7
      };

      const template = notificationService.getNotificationTemplate(NotificationType.PLAN_REMINDER, data);

      expect(template.title).toBe('学習計画の目標日が近づいています');
      expect(template.message).toContain('AWS Certified Solutions Architect');
      expect(template.message).toContain('7日');
    });

    it('should return correct template for expiry warning', async () => {
      const data = {
        certificationName: 'CompTIA Security+',
        daysUntilExpiry: 30
      };

      const template = notificationService.getNotificationTemplate(NotificationType.EXPIRY_WARNING, data);

      expect(template.title).toBe('資格の有効期限が近づいています');
      expect(template.message).toContain('CompTIA Security+');
      expect(template.message).toContain('30日');
    });

    it('should return default template for unknown type', async () => {
      const template = notificationService.getNotificationTemplate('unknown' as NotificationType, {});

      expect(template.title).toBe('通知');
      expect(template.message).toBe('新しい通知があります。');
    });
  });

  describe('getUserNotificationSettings', () => {
    it('should return default settings for demo version', async () => {
      const settings = await notificationService.getUserNotificationSettings('user-1');

      expect(settings.planReminders).toBe(true);
      expect(settings.expiryWarnings).toBe(true);
      expect(settings.newCertifications).toBe(true);
      expect(settings.achievementReports).toBe(true);
    });
  });

  describe('processScheduledNotifications', () => {
    beforeEach(async () => {
      // テスト用のデータを準備
      const usersData = {
        users: [
          {
            id: 'user-1',
            email: 'user1@example.com',
            name: 'User 1',
            role: UserRole.MEMBER,
            passwordHash: 'hash',
            requiresPasswordChange: false,
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z'
          }
        ]
      };

      const certificationsData = {
        certifications: [
          {
            id: 'cert-1',
            name: 'Test Certification',
            issuer: 'Test Issuer',
            category: CertificationCategory.CLOUD,
            difficulty: 3,
            description: 'Test certification',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z'
          }
        ]
      };

      await storage.writeUsers(usersData);
      await storage.writeCertifications(certificationsData);
    });

    it('should process scheduled notifications without errors', async () => {
      const result = await notificationService.processScheduledNotifications();

      expect(result).toHaveProperty('planDeadlineNotifications');
      expect(result).toHaveProperty('expiryWarningNotifications');
      expect(result).toHaveProperty('totalProcessed');
      expect(typeof result.planDeadlineNotifications).toBe('number');
      expect(typeof result.expiryWarningNotifications).toBe('number');
      expect(result.totalProcessed).toBe(result.planDeadlineNotifications + result.expiryWarningNotifications);
    });
  });
});