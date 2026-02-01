import { Router, Request, Response } from 'express';
import { CertificationHistoryService } from '../services/achievement';
import { JSONStorage } from '../data/storage';
import { requireAuth } from '../middleware/auth';
import { CreateAchievementRequest, UpdateAchievementRequest } from '../types';

const router = Router();
const storage = new JSONStorage();
const achievementService = new CertificationHistoryService(storage);

// 認証が必要な全てのルートに適用
router.use(requireAuth);

/**
 * 資格取得履歴を追加
 * POST /api/achievements
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const achievementData: CreateAchievementRequest = req.body;
    
    // バリデーション
    if (!achievementData.certificationId || !achievementData.achievedDate) {
      return res.status(400).json({ 
        error: 'Missing required fields: certificationId, achievedDate' 
      });
    }

    // 日付の妥当性チェック
    const achievedDate = new Date(achievementData.achievedDate);
    if (isNaN(achievedDate.getTime())) {
      return res.status(400).json({ error: 'Invalid achieved date format' });
    }

    // 有効期限の妥当性チェック（指定されている場合）
    if (achievementData.expiryDate) {
      const expiryDate = new Date(achievementData.expiryDate);
      if (isNaN(expiryDate.getTime())) {
        return res.status(400).json({ error: 'Invalid expiry date format' });
      }
      if (expiryDate <= achievedDate) {
        return res.status(400).json({ error: 'Expiry date must be after achieved date' });
      }
    }

    const achievement = await achievementService.addAchievement(userId, achievementData);
    res.status(201).json(achievement);
  } catch (error) {
    console.error('Create achievement error:', error);
    if (error instanceof Error && error.message.includes('already exists')) {
      return res.status(409).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to create achievement' });
  }
});

/**
 * 資格取得履歴を更新
 * PUT /api/achievements/:id
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const achievementId = req.params.id;
    if (!achievementId) {
      return res.status(400).json({ error: 'Achievement ID is required' });
    }

    const achievementData: UpdateAchievementRequest = req.body;
    const userId = req.user?.id;

    // 既存の履歴を取得して権限チェック
    const existingAchievement = await achievementService.getAchievement(achievementId);
    if (!existingAchievement) {
      return res.status(404).json({ error: 'Achievement not found' });
    }

    // 自分の履歴または管理者のみ更新可能
    if (existingAchievement.userId !== userId && req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // 日付の妥当性チェック（更新される場合）
    if (achievementData.achievedDate) {
      const achievedDate = new Date(achievementData.achievedDate);
      if (isNaN(achievedDate.getTime())) {
        return res.status(400).json({ error: 'Invalid achieved date format' });
      }
    }

    if (achievementData.expiryDate) {
      const expiryDate = new Date(achievementData.expiryDate);
      if (isNaN(expiryDate.getTime())) {
        return res.status(400).json({ error: 'Invalid expiry date format' });
      }
      
      const achievedDate = new Date(achievementData.achievedDate || existingAchievement.achievedDate);
      if (expiryDate <= achievedDate) {
        return res.status(400).json({ error: 'Expiry date must be after achieved date' });
      }
    }

    const updatedAchievement = await achievementService.updateAchievement(achievementId, achievementData);
    res.json(updatedAchievement);
  } catch (error) {
    console.error('Update achievement error:', error);
    if (error instanceof Error && error.message === 'Achievement not found') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to update achievement' });
  }
});

/**
 * 資格取得履歴を削除
 * DELETE /api/achievements/:id
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const achievementId = req.params.id;
    if (!achievementId) {
      return res.status(400).json({ error: 'Achievement ID is required' });
    }

    const userId = req.user?.id;

    // 既存の履歴を取得して権限チェック
    const existingAchievement = await achievementService.getAchievement(achievementId);
    if (!existingAchievement) {
      return res.status(404).json({ error: 'Achievement not found' });
    }

    // 自分の履歴または管理者のみ削除可能
    if (existingAchievement.userId !== userId && req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    await achievementService.deleteAchievement(achievementId);
    res.status(204).send();
  } catch (error) {
    console.error('Delete achievement error:', error);
    if (error instanceof Error && error.message === 'Achievement not found') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to delete achievement' });
  }
});

/**
 * 自分の資格取得履歴一覧を取得
 * GET /api/achievements/my
 */
router.get('/my', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const activeOnly = req.query.active === 'true';
    const result = await achievementService.getUserAchievements(userId, activeOnly);
    res.json(result);
  } catch (error) {
    console.error('Get my achievements error:', error);
    res.status(500).json({ error: 'Failed to get achievements' });
  }
});

/**
 * ユーザーの資格取得履歴一覧を取得
 * GET /api/achievements/user/:userId
 */
router.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const targetUserId = req.params.userId;
    if (!targetUserId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const currentUserId = req.user?.id;

    // 自分の履歴または管理者のみ閲覧可能
    if (targetUserId !== currentUserId && req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const activeOnly = req.query.active === 'true';
    const achievements = await achievementService.getUserAchievements(targetUserId, activeOnly);
    res.json(achievements);
  } catch (error) {
    console.error('Get user achievements error:', error);
    res.status(500).json({ error: 'Failed to get user achievements' });
  }
});

/**
 * 資格取得履歴を取得
 * GET /api/achievements/:id
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const achievementId = req.params.id;
    if (!achievementId) {
      return res.status(400).json({ error: 'Achievement ID is required' });
    }

    const userId = req.user?.id;

    const achievement = await achievementService.getAchievement(achievementId);
    if (!achievement) {
      return res.status(404).json({ error: 'Achievement not found' });
    }

    // 自分の履歴または管理者のみ閲覧可能
    if (achievement.userId !== userId && req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ success: true, data: { achievement } });
  } catch (error) {
    console.error('Get achievement error:', error);
    res.status(500).json({ error: 'Failed to get achievement' });
  }
});

/**
 * 全ての資格取得履歴を取得（管理者のみ）
 * GET /api/achievements
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    // 管理者のみアクセス可能
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const activeOnly = req.query.active === 'true';
    const result = await achievementService.listAllAchievements(activeOnly);
    res.json(result);
  } catch (error) {
    console.error('Get all achievements error:', error);
    res.status(500).json({ error: 'Failed to get achievements' });
  }
});

/**
 * 有効期限が近い資格を取得
 * GET /api/achievements/expiring
 */
router.get('/expiring', async (req: Request, res: Response) => {
  try {
    const daysAhead = parseInt(req.query.days as string) || 90;
    const userId = req.user?.id;

    if (daysAhead < 1 || daysAhead > 365) {
      return res.status(400).json({ error: 'Days ahead must be between 1 and 365' });
    }

    let achievements = await achievementService.getExpiringCertifications(daysAhead);

    // 管理者以外は自分の履歴のみ
    if (req.user?.role !== 'admin') {
      achievements = achievements.filter(achievement => achievement.userId === userId);
    }

    res.json(achievements);
  } catch (error) {
    console.error('Get expiring achievements error:', error);
    res.status(500).json({ error: 'Failed to get expiring achievements' });
  }
});

/**
 * 期限切れの資格を取得
 * GET /api/achievements/expired
 */
router.get('/expired', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    let achievements = await achievementService.getExpiredCertifications();

    // 管理者以外は自分の履歴のみ
    if (req.user?.role !== 'admin') {
      achievements = achievements.filter(achievement => achievement.userId === userId);
    }

    res.json(achievements);
  } catch (error) {
    console.error('Get expired achievements error:', error);
    res.status(500).json({ error: 'Failed to get expired achievements' });
  }
});

/**
 * 資格を無効化
 * PATCH /api/achievements/:id/deactivate
 */
router.patch('/:id/deactivate', async (req: Request, res: Response) => {
  try {
    const achievementId = req.params.id;
    if (!achievementId) {
      return res.status(400).json({ error: 'Achievement ID is required' });
    }

    const userId = req.user?.id;

    // 既存の履歴を取得して権限チェック
    const existingAchievement = await achievementService.getAchievement(achievementId);
    if (!existingAchievement) {
      return res.status(404).json({ error: 'Achievement not found' });
    }

    // 自分の履歴または管理者のみ更新可能
    if (existingAchievement.userId !== userId && req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updatedAchievement = await achievementService.deactivateAchievement(achievementId);
    res.json(updatedAchievement);
  } catch (error) {
    console.error('Deactivate achievement error:', error);
    if (error instanceof Error && error.message === 'Achievement not found') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to deactivate achievement' });
  }
});

/**
 * 資格を再有効化
 * PATCH /api/achievements/:id/reactivate
 */
router.patch('/:id/reactivate', async (req: Request, res: Response) => {
  try {
    const achievementId = req.params.id;
    if (!achievementId) {
      return res.status(400).json({ error: 'Achievement ID is required' });
    }

    const userId = req.user?.id;

    // 既存の履歴を取得して権限チェック
    const existingAchievement = await achievementService.getAchievement(achievementId);
    if (!existingAchievement) {
      return res.status(404).json({ error: 'Achievement not found' });
    }

    // 自分の履歴または管理者のみ更新可能
    if (existingAchievement.userId !== userId && req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updatedAchievement = await achievementService.reactivateAchievement(achievementId);
    res.json(updatedAchievement);
  } catch (error) {
    console.error('Reactivate achievement error:', error);
    if (error instanceof Error && error.message === 'Achievement not found') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to reactivate achievement' });
  }
});

/**
 * 自分の取得統計を取得
 * GET /api/achievements/my/stats
 */
router.get('/my/stats', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const stats = await achievementService.getUserAchievementStats(userId);
    res.json(stats);
  } catch (error) {
    console.error('Get user achievement stats error:', error);
    res.status(500).json({ error: 'Failed to get achievement statistics' });
  }
});

/**
 * 資格別の取得統計を取得（管理者のみ）
 * GET /api/achievements/stats/certifications
 */
router.get('/stats/certifications', async (req: Request, res: Response) => {
  try {
    // 管理者のみアクセス可能
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const stats = await achievementService.getCertificationAchievementStats();
    res.json(stats);
  } catch (error) {
    console.error('Get certification achievement stats error:', error);
    res.status(500).json({ error: 'Failed to get certification statistics' });
  }
});

/**
 * 期間別の取得履歴を取得（管理者のみ）
 * GET /api/achievements/period
 */
router.get('/period', async (req: Request, res: Response) => {
  try {
    // 管理者のみアクセス可能
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }

    // 日付の妥当性チェック
    if (isNaN(new Date(startDate).getTime()) || isNaN(new Date(endDate).getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    if (new Date(startDate) >= new Date(endDate)) {
      return res.status(400).json({ error: 'Start date must be before end date' });
    }

    const achievements = await achievementService.getAchievementsByPeriod(startDate, endDate);
    res.json(achievements);
  } catch (error) {
    console.error('Get achievements by period error:', error);
    res.status(500).json({ error: 'Failed to get achievements by period' });
  }
});

/**
 * 資格の更新履歴を取得
 * GET /api/achievements/renewal/:userId/:certificationId
 */
router.get('/renewal/:userId/:certificationId', async (req: Request, res: Response) => {
  try {
    const targetUserId = req.params.userId;
    const certificationId = req.params.certificationId;
    
    if (!targetUserId || !certificationId) {
      return res.status(400).json({ error: 'User ID and Certification ID are required' });
    }

    const currentUserId = req.user?.id;

    // 自分の履歴または管理者のみ閲覧可能
    if (targetUserId !== currentUserId && req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const renewalHistory = await achievementService.getCertificationRenewalHistory(targetUserId, certificationId);
    res.json(renewalHistory);
  } catch (error) {
    console.error('Get renewal history error:', error);
    res.status(500).json({ error: 'Failed to get renewal history' });
  }
});

/**
 * 期限切れ処理を実行（管理者のみ）
 * POST /api/achievements/process-expired
 */
router.post('/process-expired', async (req: Request, res: Response) => {
  try {
    // 管理者のみアクセス可能
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const result = await achievementService.processExpiredCertifications();
    res.json(result);
  } catch (error) {
    console.error('Process expired certifications error:', error);
    res.status(500).json({ error: 'Failed to process expired certifications' });
  }
});

export default router;