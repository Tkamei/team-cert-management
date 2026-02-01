import { Router, Request, Response } from 'express';
import { StudyPlanService } from '../services/studyPlan';
import { JSONStorage } from '../data/storage';
import { requireAuth } from '../middleware/auth';
import { CreatePlanRequest, UpdatePlanRequest, PlanStatus } from '../types';

const router = Router();
const storage = new JSONStorage();
const studyPlanService = new StudyPlanService(storage);

// 認証が必要な全てのルートに適用
router.use(requireAuth);

/**
 * 学習計画を作成
 * POST /api/study-plans
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const planData: CreatePlanRequest = req.body;
    
    // バリデーション
    if (!planData.certificationId || !planData.targetDate || !planData.startDate) {
      return res.status(400).json({ 
        error: 'Missing required fields: certificationId, targetDate, startDate' 
      });
    }

    // 日付の妥当性チェック
    const startDate = new Date(planData.startDate);
    const targetDate = new Date(planData.targetDate);
    
    if (isNaN(startDate.getTime()) || isNaN(targetDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    if (targetDate <= startDate) {
      return res.status(400).json({ error: 'Target date must be after start date' });
    }

    const plan = await studyPlanService.createPlan(userId, planData);
    res.status(201).json(plan);
  } catch (error) {
    console.error('Create study plan error:', error);
    if (error instanceof Error && error.message.includes('already exists')) {
      return res.status(409).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to create study plan' });
  }
});

/**
 * 学習計画を更新
 * PUT /api/study-plans/:id
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const planId = req.params.id;
    if (!planId) {
      return res.status(400).json({ error: 'Plan ID is required' });
    }
    
    const planData: UpdatePlanRequest = req.body;
    const userId = req.user?.id;

    // 既存の計画を取得して権限チェック
    const existingPlan = await studyPlanService.getPlan(planId);
    if (!existingPlan) {
      return res.status(404).json({ error: 'Study plan not found' });
    }

    // 自分の計画または管理者のみ更新可能
    if (existingPlan.userId !== userId && req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // 日付の妥当性チェック（更新される場合）
    if (planData.startDate && planData.targetDate) {
      const startDate = new Date(planData.startDate);
      const targetDate = new Date(planData.targetDate);
      
      if (targetDate <= startDate) {
        return res.status(400).json({ error: 'Target date must be after start date' });
      }
    }

    const updatedPlan = await studyPlanService.updatePlan(planId, planData);
    res.json(updatedPlan);
  } catch (error) {
    console.error('Update study plan error:', error);
    if (error instanceof Error && error.message === 'Study plan not found') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to update study plan' });
  }
});

/**
 * 学習計画を削除
 * DELETE /api/study-plans/:id
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const planId = req.params.id;
    if (!planId) {
      return res.status(400).json({ error: 'Plan ID is required' });
    }
    
    const userId = req.user?.id;

    // 既存の計画を取得して権限チェック
    const existingPlan = await studyPlanService.getPlan(planId);
    if (!existingPlan) {
      return res.status(404).json({ error: 'Study plan not found' });
    }

    // 自分の計画または管理者のみ削除可能
    if (existingPlan.userId !== userId && req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    await studyPlanService.deletePlan(planId);
    res.status(204).send();
  } catch (error) {
    console.error('Delete study plan error:', error);
    if (error instanceof Error && error.message === 'Study plan not found') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to delete study plan' });
  }
});

/**
 * 自分の学習計画一覧を取得
 * GET /api/study-plans/my
 */
router.get('/my', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const plans = await studyPlanService.getUserPlans(userId);
    res.json({ success: true, data: { plans } });
  } catch (error) {
    console.error('Get my study plans error:', error);
    res.status(500).json({ error: 'Failed to get study plans' });
  }
});

/**
 * 自分の学習計画統計を取得
 * GET /api/study-plans/my/stats
 */
router.get('/my/stats', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const stats = await studyPlanService.getUserPlanStats(userId);
    res.json(stats);
  } catch (error) {
    console.error('Get user plan stats error:', error);
    res.status(500).json({ error: 'Failed to get plan statistics' });
  }
});

/**
 * 期限が近い学習計画を取得
 * GET /api/study-plans/upcoming-deadlines
 */
router.get('/upcoming-deadlines', async (req: Request, res: Response) => {
  try {
    const daysAhead = parseInt(req.query.days as string) || 30;
    const userId = req.user?.id;

    if (daysAhead < 1 || daysAhead > 365) {
      return res.status(400).json({ error: 'Days ahead must be between 1 and 365' });
    }

    let plans = await studyPlanService.getUpcomingDeadlines(daysAhead);

    // 管理者以外は自分の計画のみ
    if (req.user?.role !== 'admin') {
      plans = plans.filter(plan => plan.userId === userId);
    }

    res.json(plans);
  } catch (error) {
    console.error('Get upcoming deadlines error:', error);
    res.status(500).json({ error: 'Failed to get upcoming deadlines' });
  }
});

/**
 * 資格別の学習計画統計を取得（管理者のみ）
 * GET /api/study-plans/stats/certifications
 */
router.get('/stats/certifications', async (req: Request, res: Response) => {
  try {
    // 管理者のみアクセス可能
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const stats = await studyPlanService.getCertificationPlanStats();
    res.json(stats);
  } catch (error) {
    console.error('Get certification plan stats error:', error);
    res.status(500).json({ error: 'Failed to get certification statistics' });
  }
});

/**
 * ユーザーの学習計画一覧を取得
 * GET /api/study-plans/user/:userId
 */
router.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const targetUserId = req.params.userId;
    if (!targetUserId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    const currentUserId = req.user?.id;

    // 自分の計画または管理者のみ閲覧可能
    if (targetUserId !== currentUserId && req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const plans = await studyPlanService.getUserPlans(targetUserId);
    res.json(plans);
  } catch (error) {
    console.error('Get user study plans error:', error);
    res.status(500).json({ error: 'Failed to get user study plans' });
  }
});

/**
 * 学習計画を取得
 * GET /api/study-plans/:id
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const planId = req.params.id;
    if (!planId) {
      return res.status(400).json({ error: 'Plan ID is required' });
    }
    
    const userId = req.user?.id;

    const plan = await studyPlanService.getPlan(planId);
    if (!plan) {
      return res.status(404).json({ error: 'Study plan not found' });
    }

    // 自分の計画または管理者のみ閲覧可能
    if (plan.userId !== userId && req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ success: true, data: { plan } });
  } catch (error) {
    console.error('Get study plan error:', error);
    res.status(500).json({ error: 'Failed to get study plan' });
  }
});

/**
 * 進捗を更新
 * PATCH /api/study-plans/:id/progress
 */
router.patch('/:id/progress', async (req: Request, res: Response) => {
  try {
    const planId = req.params.id;
    if (!planId) {
      return res.status(400).json({ error: 'Plan ID is required' });
    }
    
    const { progress } = req.body;
    const userId = req.user?.id;

    if (typeof progress !== 'number' || progress < 0 || progress > 100) {
      return res.status(400).json({ error: 'Progress must be a number between 0 and 100' });
    }

    // 既存の計画を取得して権限チェック
    const existingPlan = await studyPlanService.getPlan(planId);
    if (!existingPlan) {
      return res.status(404).json({ error: 'Study plan not found' });
    }

    // 自分の計画または管理者のみ更新可能
    if (existingPlan.userId !== userId && req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updatedPlan = await studyPlanService.updateProgress(planId, progress);
    res.json(updatedPlan);
  } catch (error) {
    console.error('Update progress error:', error);
    if (error instanceof Error && error.message === 'Study plan not found') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to update progress' });
  }
});

/**
 * 全ての学習計画を取得（管理者のみ）
 * GET /api/study-plans
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    // 管理者のみアクセス可能
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const status = req.query.status as PlanStatus;
    let plans;

    if (status && Object.values(PlanStatus).includes(status)) {
      plans = await studyPlanService.getPlansByStatus(status);
    } else {
      plans = await studyPlanService.listAllPlans();
    }

    res.json({ success: true, data: { plans } });
  } catch (error) {
    console.error('Get all study plans error:', error);
    res.status(500).json({ error: 'Failed to get study plans' });
  }
});

export default router;