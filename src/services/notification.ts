import { v4 as uuidv4 } from 'uuid';
import { JSONStorage } from '../data/storage';
import { 
  Notification, 
  NotificationType,
  NotificationsData,
  StudyPlan,
  Achievement,
  User
} from '../types';

export class SimpleNotificationService {
  constructor(private storage: JSONStorage) {}

  /**
   * 通知を作成
   */
  async createNotification(
    userId: string, 
    type: NotificationType, 
    title: string, 
    message: string, 
    data?: any
  ): Promise<Notification> {
    const notificationsData = await this.storage.readNotifications();
    
    const now = new Date().toISOString();
    const newNotification: Notification = {
      id: uuidv4(),
      userId,
      type,
      title,
      message,
      data,
      isRead: false,
      createdAt: now
    };

    notificationsData.notifications.push(newNotification);
    await this.storage.writeNotifications(notificationsData);

    return newNotification;
  }

  /**
   * ユーザーの通知一覧を取得
   */
  async getUserNotifications(userId: string, unreadOnly: boolean = false): Promise<Notification[]> {
    const data = await this.storage.readNotifications();
    return data.notifications
      .filter(notification => {
        if (notification.userId !== userId) return false;
        if (unreadOnly && notification.isRead) return false;
        return true;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * 通知を既読にする
   */
  async markAsRead(notificationId: string): Promise<Notification> {
    const data = await this.storage.readNotifications();
    const notificationIndex = data.notifications.findIndex(n => n.id === notificationId);
    
    if (notificationIndex === -1) {
      throw new Error('Notification not found');
    }

    data.notifications[notificationIndex]!.isRead = true;
    await this.storage.writeNotifications(data);

    return data.notifications[notificationIndex]!;
  }

  /**
   * ユーザーの全通知を既読にする
   */
  async markAllAsRead(userId: string): Promise<number> {
    const data = await this.storage.readNotifications();
    let updatedCount = 0;

    for (let i = 0; i < data.notifications.length; i++) {
      const notification = data.notifications[i]!;
      if (notification.userId === userId && !notification.isRead) {
        data.notifications[i]!.isRead = true;
        updatedCount++;
      }
    }

    if (updatedCount > 0) {
      await this.storage.writeNotifications(data);
    }

    return updatedCount;
  }

  /**
   * 通知を削除
   */
  async deleteNotification(notificationId: string): Promise<void> {
    const data = await this.storage.readNotifications();
    const notificationIndex = data.notifications.findIndex(n => n.id === notificationId);
    
    if (notificationIndex === -1) {
      throw new Error('Notification not found');
    }

    data.notifications.splice(notificationIndex, 1);
    await this.storage.writeNotifications(data);
  }

  /**
   * ユーザーの古い通知を削除
   */
  async deleteOldNotifications(userId: string, daysOld: number = 30): Promise<number> {
    const data = await this.storage.readNotifications();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const initialCount = data.notifications.length;
    data.notifications = data.notifications.filter(notification => {
      if (notification.userId !== userId) return true;
      return new Date(notification.createdAt) > cutoffDate;
    });

    const deletedCount = initialCount - data.notifications.length;
    if (deletedCount > 0) {
      await this.storage.writeNotifications(data);
    }

    return deletedCount;
  }

  /**
   * 学習計画の目標日通知を生成
   */
  async createPlanDeadlineNotifications(): Promise<number> {
    const studyPlansData = await this.storage.readStudyPlans();
    const certificationsData = await this.storage.readCertifications();
    const usersData = await this.storage.readUsers();
    
    let notificationCount = 0;
    const now = new Date();
    const reminderDays = [30, 14, 7, 3, 1]; // 30日前、14日前、7日前、3日前、1日前

    for (const plan of studyPlansData.studyPlans) {
      if (plan.status !== 'in_progress' && plan.status !== 'planning') continue;

      const targetDate = new Date(plan.targetDate);
      const daysUntilTarget = Math.ceil((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (reminderDays.includes(daysUntilTarget)) {
        const certification = certificationsData.certifications.find(c => c.id === plan.certificationId);
        const user = usersData.users.find(u => u.id === plan.userId);

        if (certification && user) {
          // 既に同じ日付で通知が送られていないかチェック
          const existingNotifications = await this.getUserNotifications(plan.userId);
          const todayNotification = existingNotifications.find(n => 
            n.type === NotificationType.PLAN_REMINDER &&
            n.data?.planId === plan.id &&
            new Date(n.createdAt).toDateString() === now.toDateString()
          );

          if (!todayNotification) {
            await this.createNotification(
              plan.userId,
              NotificationType.PLAN_REMINDER,
              `学習計画の目標日が近づいています`,
              `「${certification.name}」の目標日まで${daysUntilTarget}日です。進捗状況を確認してください。`,
              {
                planId: plan.id,
                certificationId: plan.certificationId,
                targetDate: plan.targetDate,
                daysUntilTarget
              }
            );
            notificationCount++;
          }
        }
      }
    }

    return notificationCount;
  }

  /**
   * 資格有効期限通知を生成
   */
  async createExpiryWarningNotifications(): Promise<number> {
    const achievementsData = await this.storage.readAchievements();
    const certificationsData = await this.storage.readCertifications();
    const usersData = await this.storage.readUsers();
    
    let notificationCount = 0;
    const now = new Date();
    const warningDays = [90, 60, 30, 14, 7]; // 90日前、60日前、30日前、14日前、7日前

    for (const achievement of achievementsData.achievements) {
      if (!achievement.isActive || !achievement.expiryDate) continue;

      const expiryDate = new Date(achievement.expiryDate);
      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (warningDays.includes(daysUntilExpiry)) {
        const certification = certificationsData.certifications.find(c => c.id === achievement.certificationId);
        const user = usersData.users.find(u => u.id === achievement.userId);

        if (certification && user) {
          // 既に同じ日付で通知が送られていないかチェック
          const existingNotifications = await this.getUserNotifications(achievement.userId);
          const todayNotification = existingNotifications.find(n => 
            n.type === NotificationType.EXPIRY_WARNING &&
            n.data?.achievementId === achievement.id &&
            new Date(n.createdAt).toDateString() === now.toDateString()
          );

          if (!todayNotification) {
            await this.createNotification(
              achievement.userId,
              NotificationType.EXPIRY_WARNING,
              `資格の有効期限が近づいています`,
              `「${certification.name}」の有効期限まで${daysUntilExpiry}日です。更新の準備をしてください。`,
              {
                achievementId: achievement.id,
                certificationId: achievement.certificationId,
                expiryDate: achievement.expiryDate,
                daysUntilExpiry
              }
            );
            notificationCount++;
          }
        }
      }
    }

    return notificationCount;
  }

  /**
   * 新資格追加通知を全員に送信
   */
  async createNewCertificationNotification(certificationId: string): Promise<number> {
    const certificationsData = await this.storage.readCertifications();
    const usersData = await this.storage.readUsers();
    
    const certification = certificationsData.certifications.find(c => c.id === certificationId);
    if (!certification) {
      throw new Error('Certification not found');
    }

    let notificationCount = 0;

    for (const user of usersData.users) {
      await this.createNotification(
        user.id,
        NotificationType.NEW_CERTIFICATION,
        `新しい資格が追加されました`,
        `「${certification.name}」が資格リストに追加されました。詳細を確認してください。`,
        {
          certificationId: certification.id,
          certificationName: certification.name,
          category: certification.category
        }
      );
      notificationCount++;
    }

    return notificationCount;
  }

  /**
   * 取得完了通知を管理者に送信
   */
  async createAchievementReportNotification(achievementId: string): Promise<number> {
    const achievementsData = await this.storage.readAchievements();
    const certificationsData = await this.storage.readCertifications();
    const usersData = await this.storage.readUsers();
    
    const achievement = achievementsData.achievements.find(a => a.id === achievementId);
    if (!achievement) {
      throw new Error('Achievement not found');
    }

    const certification = certificationsData.certifications.find(c => c.id === achievement.certificationId);
    const user = usersData.users.find(u => u.id === achievement.userId);
    
    if (!certification || !user) {
      throw new Error('Related certification or user not found');
    }

    let notificationCount = 0;
    const adminUsers = usersData.users.filter(u => u.role === 'admin');

    for (const admin of adminUsers) {
      await this.createNotification(
        admin.id,
        NotificationType.ACHIEVEMENT_REPORT,
        `資格取得の報告がありました`,
        `${user.name}さんが「${certification.name}」を取得しました。`,
        {
          achievementId: achievement.id,
          userId: achievement.userId,
          userName: user.name,
          certificationId: achievement.certificationId,
          certificationName: certification.name,
          achievedDate: achievement.achievedDate
        }
      );
      notificationCount++;
    }

    return notificationCount;
  }

  /**
   * 通知統計を取得
   */
  async getNotificationStats(userId: string): Promise<{
    totalNotifications: number;
    unreadNotifications: number;
    notificationsByType: Array<{
      type: NotificationType;
      count: number;
      unreadCount: number;
    }>;
  }> {
    const notifications = await this.getUserNotifications(userId);
    const unreadNotifications = notifications.filter(n => !n.isRead);

    const typeStats = new Map<NotificationType, { count: number; unreadCount: number }>();
    
    notifications.forEach(notification => {
      if (!typeStats.has(notification.type)) {
        typeStats.set(notification.type, { count: 0, unreadCount: 0 });
      }
      const stat = typeStats.get(notification.type)!;
      stat.count++;
      if (!notification.isRead) {
        stat.unreadCount++;
      }
    });

    return {
      totalNotifications: notifications.length,
      unreadNotifications: unreadNotifications.length,
      notificationsByType: Array.from(typeStats.entries()).map(([type, stat]) => ({
        type,
        count: stat.count,
        unreadCount: stat.unreadCount
      }))
    };
  }

  /**
   * 定期的な通知処理を実行
   */
  async processScheduledNotifications(): Promise<{
    planDeadlineNotifications: number;
    expiryWarningNotifications: number;
    totalProcessed: number;
  }> {
    const planDeadlineNotifications = await this.createPlanDeadlineNotifications();
    const expiryWarningNotifications = await this.createExpiryWarningNotifications();

    return {
      planDeadlineNotifications,
      expiryWarningNotifications,
      totalProcessed: planDeadlineNotifications + expiryWarningNotifications
    };
  }

  /**
   * 通知テンプレートを取得（将来の拡張用）
   */
  getNotificationTemplate(type: NotificationType, data: any): { title: string; message: string } {
    switch (type) {
      case NotificationType.PLAN_REMINDER:
        return {
          title: '学習計画の目標日が近づいています',
          message: `「${data.certificationName}」の目標日まで${data.daysUntilTarget}日です。`
        };
      
      case NotificationType.EXPIRY_WARNING:
        return {
          title: '資格の有効期限が近づいています',
          message: `「${data.certificationName}」の有効期限まで${data.daysUntilExpiry}日です。`
        };
      
      case NotificationType.NEW_CERTIFICATION:
        return {
          title: '新しい資格が追加されました',
          message: `「${data.certificationName}」が資格リストに追加されました。`
        };
      
      case NotificationType.ACHIEVEMENT_REPORT:
        return {
          title: '資格取得の報告がありました',
          message: `${data.userName}さんが「${data.certificationName}」を取得しました。`
        };
      
      default:
        return {
          title: '通知',
          message: '新しい通知があります。'
        };
    }
  }

  /**
   * 通知設定を管理（将来の拡張用）
   */
  async getUserNotificationSettings(userId: string): Promise<{
    planReminders: boolean;
    expiryWarnings: boolean;
    newCertifications: boolean;
    achievementReports: boolean;
  }> {
    // デモ版では全て有効
    return {
      planReminders: true,
      expiryWarnings: true,
      newCertifications: true,
      achievementReports: true
    };
  }

  /**
   * 通知設定を更新（将来の拡張用）
   */
  async updateUserNotificationSettings(
    userId: string, 
    settings: {
      planReminders?: boolean;
      expiryWarnings?: boolean;
      newCertifications?: boolean;
      achievementReports?: boolean;
    }
  ): Promise<void> {
    // デモ版では設定変更は実装しない
    console.log(`Notification settings update requested for user ${userId}:`, settings);
  }
}