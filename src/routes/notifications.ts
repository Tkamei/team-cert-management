import { Router, Request, Response } from 'express';
import { SimpleNotificationService } from '../services/notification';
import { JSONStorage } from '../data/storage';
import { requireAuth } from '../middleware/auth';
import { NotificationType } from '../types';

const router = Router();
const storage = new JSONStorage();
const notificationService = new SimpleNotificationService(storage);

// 認証が必要な全てのルートに適用
router.use(requireAuth);

/**
 * 自分の通知一覧を取得
 * GET /api/notifications
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const unreadOnly = req.query.unread === 'true';
    const notifications = await notificationService.getUserNotifications(userId, unreadOnly);
    res.json({ success: true, data: { notifications } });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to get notifications' });
  }
});

/**
 * 通知を既読にする
 * PATCH /api/notifications/:id/read
 */
router.patch('/:id/read', async (req: Request, res: Response) => {
  try {
    const notificationId = req.params.id;
    if (!notificationId) {
      return res.status(400).json({ error: 'Notification ID is required' });
    }

    const userId = req.user?.id;

    // 通知の所有者チェック
    const notifications = await notificationService.getUserNotifications(userId!);
    const notification = notifications.find(n => n.id === notificationId);
    
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    const updatedNotification = await notificationService.markAsRead(notificationId);
    res.json(updatedNotification);
  } catch (error) {
    console.error('Mark notification as read error:', error);
    if (error instanceof Error && error.message === 'Notification not found') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

/**
 * 全通知を既読にする
 * PATCH /api/notifications/read-all
 */
router.patch('/read-all', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const updatedCount = await notificationService.markAllAsRead(userId);
    res.json({ updatedCount });
  } catch (error) {
    console.error('Mark all notifications as read error:', error);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
});

/**
 * 通知を削除
 * DELETE /api/notifications/:id
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const notificationId = req.params.id;
    if (!notificationId) {
      return res.status(400).json({ error: 'Notification ID is required' });
    }

    const userId = req.user?.id;

    // 通知の所有者チェック
    const notifications = await notificationService.getUserNotifications(userId!);
    const notification = notifications.find(n => n.id === notificationId);
    
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    await notificationService.deleteNotification(notificationId);
    res.status(204).send();
  } catch (error) {
    console.error('Delete notification error:', error);
    if (error instanceof Error && error.message === 'Notification not found') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

/**
 * 古い通知を削除
 * DELETE /api/notifications/old
 */
router.delete('/old', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const daysOld = parseInt(req.query.days as string) || 30;
    
    if (daysOld < 1 || daysOld > 365) {
      return res.status(400).json({ error: 'Days must be between 1 and 365' });
    }

    const deletedCount = await notificationService.deleteOldNotifications(userId, daysOld);
    res.json({ deletedCount });
  } catch (error) {
    console.error('Delete old notifications error:', error);
    res.status(500).json({ error: 'Failed to delete old notifications' });
  }
});

/**
 * 通知統計を取得
 * GET /api/notifications/stats
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const stats = await notificationService.getNotificationStats(userId);
    res.json(stats);
  } catch (error) {
    console.error('Get notification stats error:', error);
    res.status(500).json({ error: 'Failed to get notification statistics' });
  }
});

/**
 * 通知設定を取得
 * GET /api/notifications/settings
 */
router.get('/settings', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const settings = await notificationService.getUserNotificationSettings(userId);
    res.json(settings);
  } catch (error) {
    console.error('Get notification settings error:', error);
    res.status(500).json({ error: 'Failed to get notification settings' });
  }
});

/**
 * 通知設定を更新
 * PUT /api/notifications/settings
 */
router.put('/settings', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const settings = req.body;
    await notificationService.updateUserNotificationSettings(userId, settings);
    
    const updatedSettings = await notificationService.getUserNotificationSettings(userId);
    res.json(updatedSettings);
  } catch (error) {
    console.error('Update notification settings error:', error);
    res.status(500).json({ error: 'Failed to update notification settings' });
  }
});

/**
 * 手動で通知を作成（管理者のみ）
 * POST /api/notifications
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    // 管理者のみアクセス可能
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { userId, type, title, message, data } = req.body;

    if (!userId || !type || !title || !message) {
      return res.status(400).json({ 
        error: 'Missing required fields: userId, type, title, message' 
      });
    }

    // 有効な通知タイプかチェック
    if (!Object.values(NotificationType).includes(type)) {
      return res.status(400).json({ error: 'Invalid notification type' });
    }

    const notification = await notificationService.createNotification(
      userId, 
      type, 
      title, 
      message, 
      data
    );
    
    res.status(201).json(notification);
  } catch (error) {
    console.error('Create notification error:', error);
    res.status(500).json({ error: 'Failed to create notification' });
  }
});

/**
 * 新資格追加通知を送信（管理者のみ）
 * POST /api/notifications/new-certification
 */
router.post('/new-certification', async (req: Request, res: Response) => {
  try {
    // 管理者のみアクセス可能
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { certificationId } = req.body;

    if (!certificationId) {
      return res.status(400).json({ error: 'Certification ID is required' });
    }

    const notificationCount = await notificationService.createNewCertificationNotification(certificationId);
    res.json({ notificationCount });
  } catch (error) {
    console.error('Create new certification notification error:', error);
    if (error instanceof Error && error.message === 'Certification not found') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to create new certification notification' });
  }
});

/**
 * 取得完了通知を送信（管理者のみ）
 * POST /api/notifications/achievement-report
 */
router.post('/achievement-report', async (req: Request, res: Response) => {
  try {
    // 管理者のみアクセス可能
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { achievementId } = req.body;

    if (!achievementId) {
      return res.status(400).json({ error: 'Achievement ID is required' });
    }

    const notificationCount = await notificationService.createAchievementReportNotification(achievementId);
    res.json({ notificationCount });
  } catch (error) {
    console.error('Create achievement report notification error:', error);
    if (error instanceof Error && (
      error.message === 'Achievement not found' || 
      error.message === 'Related certification or user not found'
    )) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to create achievement report notification' });
  }
});

/**
 * 定期通知処理を実行（管理者のみ）
 * POST /api/notifications/process-scheduled
 */
router.post('/process-scheduled', async (req: Request, res: Response) => {
  try {
    // 管理者のみアクセス可能
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const result = await notificationService.processScheduledNotifications();
    res.json(result);
  } catch (error) {
    console.error('Process scheduled notifications error:', error);
    res.status(500).json({ error: 'Failed to process scheduled notifications' });
  }
});

/**
 * 通知テンプレートを取得（管理者のみ）
 * GET /api/notifications/template/:type
 */
router.get('/template/:type', async (req: Request, res: Response) => {
  try {
    // 管理者のみアクセス可能
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const type = req.params.type as NotificationType;
    
    if (!Object.values(NotificationType).includes(type)) {
      return res.status(400).json({ error: 'Invalid notification type' });
    }

    const sampleData = {
      certificationName: 'サンプル資格',
      daysUntilTarget: 7,
      daysUntilExpiry: 30,
      userName: 'サンプルユーザー'
    };

    const template = notificationService.getNotificationTemplate(type, sampleData);
    res.json({ type, template });
  } catch (error) {
    console.error('Get notification template error:', error);
    res.status(500).json({ error: 'Failed to get notification template' });
  }
});

export default router;