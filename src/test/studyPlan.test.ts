import { StudyPlanService } from '../services/studyPlan';
import { JSONStorage } from '../data/storage';
import { PlanStatus } from '../types';

describe('StudyPlanService', () => {
  const testDataDir = './test-data-study-plan';
  let storage: JSONStorage;
  let studyPlanService: StudyPlanService;

  beforeEach(async () => {
    storage = new JSONStorage(testDataDir);
    await storage.initializeDataDirectory();
    studyPlanService = new StudyPlanService(storage);
  });

  describe('createPlan', () => {
    it('should create a new study plan', async () => {
      const userId = 'user-1';
      const planData = {
        certificationId: 'cert-1',
        targetDate: '2024-12-31',
        startDate: '2024-01-01'
      };

      const plan = await studyPlanService.createPlan(userId, planData);

      expect(plan.userId).toBe(userId);
      expect(plan.certificationId).toBe(planData.certificationId);
      expect(plan.targetDate).toBe(planData.targetDate);
      expect(plan.startDate).toBe(planData.startDate);
      expect(plan.progress).toBe(0);
      expect(plan.status).toBe(PlanStatus.PLANNING);
      expect(plan.id).toBeDefined();
      expect(plan.createdAt).toBeDefined();
      expect(plan.updatedAt).toBeDefined();
    });

    it('should not allow duplicate active plans for same certification', async () => {
      const userId = 'user-1';
      const planData = {
        certificationId: 'cert-1',
        targetDate: '2024-12-31',
        startDate: '2024-01-01'
      };

      await studyPlanService.createPlan(userId, planData);

      await expect(studyPlanService.createPlan(userId, planData))
        .rejects.toThrow('Active study plan for this certification already exists');
    });

    it('should allow multiple plans for different certifications', async () => {
      const userId = 'user-1';
      const planData1 = {
        certificationId: 'cert-1',
        targetDate: '2024-12-31',
        startDate: '2024-01-01'
      };
      const planData2 = {
        certificationId: 'cert-2',
        targetDate: '2024-12-31',
        startDate: '2024-01-01'
      };

      const plan1 = await studyPlanService.createPlan(userId, planData1);
      const plan2 = await studyPlanService.createPlan(userId, planData2);

      expect(plan1.certificationId).toBe('cert-1');
      expect(plan2.certificationId).toBe('cert-2');
    });
  });

  describe('updatePlan', () => {
    it('should update plan information', async () => {
      const userId = 'user-1';
      const planData = {
        certificationId: 'cert-1',
        targetDate: '2024-12-31',
        startDate: '2024-01-01'
      };

      const plan = await studyPlanService.createPlan(userId, planData);

      const updateData = {
        targetDate: '2025-01-31',
        progress: 50,
        status: PlanStatus.IN_PROGRESS
      };

      const updatedPlan = await studyPlanService.updatePlan(plan.id, updateData);

      expect(updatedPlan.targetDate).toBe(updateData.targetDate);
      expect(updatedPlan.progress).toBe(updateData.progress);
      expect(updatedPlan.status).toBe(updateData.status);
      expect(updatedPlan.updatedAt).not.toBe(plan.updatedAt);
    });

    it('should throw error when updating non-existent plan', async () => {
      const updateData = {
        progress: 50
      };

      await expect(studyPlanService.updatePlan('non-existent-id', updateData))
        .rejects.toThrow('Study plan not found');
    });
  });

  describe('deletePlan', () => {
    it('should delete study plan', async () => {
      const userId = 'user-1';
      const planData = {
        certificationId: 'cert-1',
        targetDate: '2024-12-31',
        startDate: '2024-01-01'
      };

      const plan = await studyPlanService.createPlan(userId, planData);

      await studyPlanService.deletePlan(plan.id);

      const deletedPlan = await studyPlanService.getPlan(plan.id);
      expect(deletedPlan).toBeNull();
    });

    it('should throw error when deleting non-existent plan', async () => {
      await expect(studyPlanService.deletePlan('non-existent-id'))
        .rejects.toThrow('Study plan not found');
    });
  });

  describe('getUserPlans', () => {
    beforeEach(async () => {
      // テスト用の学習計画を複数作成
      const plans = [
        {
          userId: 'user-1',
          certificationId: 'cert-1',
          targetDate: '2024-12-31',
          startDate: '2024-01-01'
        },
        {
          userId: 'user-1',
          certificationId: 'cert-2',
          targetDate: '2024-11-30',
          startDate: '2024-02-01'
        },
        {
          userId: 'user-2',
          certificationId: 'cert-3',
          targetDate: '2024-10-31',
          startDate: '2024-03-01'
        }
      ];

      for (const plan of plans) {
        await studyPlanService.createPlan(plan.userId, {
          certificationId: plan.certificationId,
          targetDate: plan.targetDate,
          startDate: plan.startDate
        });
      }
    });

    it('should return plans for specific user', async () => {
      const user1Plans = await studyPlanService.getUserPlans('user-1');
      const user2Plans = await studyPlanService.getUserPlans('user-2');

      expect(user1Plans).toHaveLength(2);
      expect(user2Plans).toHaveLength(1);

      user1Plans.forEach(plan => {
        expect(plan.userId).toBe('user-1');
      });

      user2Plans.forEach(plan => {
        expect(plan.userId).toBe('user-2');
      });
    });

    it('should return empty array for user with no plans', async () => {
      const plans = await studyPlanService.getUserPlans('user-3');
      expect(plans).toHaveLength(0);
    });
  });

  describe('updateProgress', () => {
    it('should update progress and auto-update status', async () => {
      const userId = 'user-1';
      const planData = {
        certificationId: 'cert-1',
        targetDate: '2024-12-31',
        startDate: '2024-01-01'
      };

      const plan = await studyPlanService.createPlan(userId, planData);

      // 進捗を50%に更新（ステータスがIN_PROGRESSに変わるはず）
      const updatedPlan1 = await studyPlanService.updateProgress(plan.id, 50);
      expect(updatedPlan1.progress).toBe(50);
      expect(updatedPlan1.status).toBe(PlanStatus.IN_PROGRESS);

      // 進捗を100%に更新（ステータスがCOMPLETEDに変わるはず）
      const updatedPlan2 = await studyPlanService.updateProgress(plan.id, 100);
      expect(updatedPlan2.progress).toBe(100);
      expect(updatedPlan2.status).toBe(PlanStatus.COMPLETED);
    });

    it('should validate progress range', async () => {
      const userId = 'user-1';
      const planData = {
        certificationId: 'cert-1',
        targetDate: '2024-12-31',
        startDate: '2024-01-01'
      };

      const plan = await studyPlanService.createPlan(userId, planData);

      await expect(studyPlanService.updateProgress(plan.id, -1))
        .rejects.toThrow('Progress must be between 0 and 100');

      await expect(studyPlanService.updateProgress(plan.id, 101))
        .rejects.toThrow('Progress must be between 0 and 100');
    });

    it('should throw error when updating progress of non-existent plan', async () => {
      await expect(studyPlanService.updateProgress('non-existent-id', 50))
        .rejects.toThrow('Study plan not found');
    });
  });

  describe('getPlansByStatus', () => {
    beforeEach(async () => {
      const userId = 'user-1';
      
      // 異なるステータスの計画を作成
      const plan1 = await studyPlanService.createPlan(userId, {
        certificationId: 'cert-1',
        targetDate: '2024-12-31',
        startDate: '2024-01-01'
      });

      const plan2 = await studyPlanService.createPlan(userId, {
        certificationId: 'cert-2',
        targetDate: '2024-11-30',
        startDate: '2024-02-01'
      });

      // 1つをIN_PROGRESSに更新
      await studyPlanService.updateProgress(plan1.id, 50);

      // もう1つをCOMPLETEDに更新
      await studyPlanService.updateProgress(plan2.id, 100);
    });

    it('should filter plans by status', async () => {
      const planningPlans = await studyPlanService.getPlansByStatus(PlanStatus.PLANNING);
      const inProgressPlans = await studyPlanService.getPlansByStatus(PlanStatus.IN_PROGRESS);
      const completedPlans = await studyPlanService.getPlansByStatus(PlanStatus.COMPLETED);

      expect(planningPlans).toHaveLength(0);
      expect(inProgressPlans).toHaveLength(1);
      expect(completedPlans).toHaveLength(1);

      expect(inProgressPlans[0]?.status).toBe(PlanStatus.IN_PROGRESS);
      expect(completedPlans[0]?.status).toBe(PlanStatus.COMPLETED);
    });
  });

  describe('getUpcomingDeadlines', () => {
    beforeEach(async () => {
      const userId = 'user-1';
      const now = new Date();
      
      // 近い期限の計画
      const nearDeadline = new Date(now);
      nearDeadline.setDate(now.getDate() + 10);
      
      // 遠い期限の計画
      const farDeadline = new Date(now);
      farDeadline.setDate(now.getDate() + 60);

      await studyPlanService.createPlan(userId, {
        certificationId: 'cert-1',
        targetDate: nearDeadline.toISOString().split('T')[0]!,
        startDate: now.toISOString().split('T')[0]!
      });

      await studyPlanService.createPlan(userId, {
        certificationId: 'cert-2',
        targetDate: farDeadline.toISOString().split('T')[0]!,
        startDate: now.toISOString().split('T')[0]!
      });
    });

    it('should return plans with upcoming deadlines', async () => {
      const upcomingPlans = await studyPlanService.getUpcomingDeadlines(30);
      expect(upcomingPlans).toHaveLength(1);
    });

    it('should return all plans within specified days', async () => {
      const upcomingPlans = await studyPlanService.getUpcomingDeadlines(90);
      expect(upcomingPlans).toHaveLength(2);
    });
  });

  describe('getUserPlanStats', () => {
    it('should return correct user statistics', async () => {
      const userId = 'user-1';
      
      // 複数の計画を作成
      const plan1 = await studyPlanService.createPlan(userId, {
        certificationId: 'cert-1',
        targetDate: '2024-12-31',
        startDate: '2024-01-01'
      });

      const plan2 = await studyPlanService.createPlan(userId, {
        certificationId: 'cert-2',
        targetDate: '2024-11-30',
        startDate: '2024-02-01'
      });

      // 進捗を更新
      await studyPlanService.updateProgress(plan1.id, 50);
      await studyPlanService.updateProgress(plan2.id, 100);

      const stats = await studyPlanService.getUserPlanStats(userId);

      expect(stats.totalPlans).toBe(2);
      expect(stats.activePlans).toBe(1); // IN_PROGRESS
      expect(stats.completedPlans).toBe(1); // COMPLETED
      expect(stats.averageProgress).toBe(75); // (50 + 100) / 2
    });
  });
});