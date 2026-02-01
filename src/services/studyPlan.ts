import { v4 as uuidv4 } from 'uuid';
import { JSONStorage } from '../data/storage';
import { 
  StudyPlan, 
  CreatePlanRequest, 
  UpdatePlanRequest, 
  PlanStatus,
  StudyPlansData 
} from '../types';

export class StudyPlanService {
  constructor(private storage: JSONStorage) {}

  /**
   * 学習計画を作成
   */
  async createPlan(userId: string, planData: CreatePlanRequest): Promise<StudyPlan> {
    const data = await this.storage.readStudyPlans();
    
    // 同じユーザーが同じ資格に対してアクティブな計画を持っていないかチェック
    const existingPlan = data.studyPlans.find(plan => 
      plan.userId === userId && 
      plan.certificationId === planData.certificationId &&
      (plan.status === PlanStatus.PLANNING || plan.status === PlanStatus.IN_PROGRESS)
    );
    
    if (existingPlan) {
      throw new Error('Active study plan for this certification already exists');
    }

    const now = new Date().toISOString();
    const newPlan: StudyPlan = {
      id: uuidv4(),
      userId,
      certificationId: planData.certificationId,
      targetDate: planData.targetDate,
      startDate: planData.startDate,
      progress: 0,
      status: PlanStatus.PLANNING,
      createdAt: now,
      updatedAt: now
    };

    data.studyPlans.push(newPlan);
    await this.storage.writeStudyPlans(data);

    return newPlan;
  }

  /**
   * 学習計画を更新
   */
  async updatePlan(planId: string, planData: UpdatePlanRequest): Promise<StudyPlan> {
    const data = await this.storage.readStudyPlans();
    const planIndex = data.studyPlans.findIndex(plan => plan.id === planId);
    
    if (planIndex === -1) {
      throw new Error('Study plan not found');
    }

    const existingPlan = data.studyPlans[planIndex]!;
    const updatedPlan: StudyPlan = {
      ...existingPlan,
      ...planData,
      updatedAt: new Date().toISOString()
    };

    data.studyPlans[planIndex] = updatedPlan;
    await this.storage.writeStudyPlans(data);

    return updatedPlan;
  }

  /**
   * 学習計画を削除
   */
  async deletePlan(planId: string): Promise<void> {
    const data = await this.storage.readStudyPlans();
    const planIndex = data.studyPlans.findIndex(plan => plan.id === planId);
    
    if (planIndex === -1) {
      throw new Error('Study plan not found');
    }

    data.studyPlans.splice(planIndex, 1);
    await this.storage.writeStudyPlans(data);
  }

  /**
   * 学習計画を取得
   */
  async getPlan(planId: string): Promise<StudyPlan | null> {
    const data = await this.storage.readStudyPlans();
    return data.studyPlans.find(plan => plan.id === planId) || null;
  }

  /**
   * ユーザーの学習計画一覧を取得
   */
  async getUserPlans(userId: string): Promise<StudyPlan[]> {
    const data = await this.storage.readStudyPlans();
    return data.studyPlans
      .filter(plan => plan.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * 全ての学習計画を取得（管理者用）
   */
  async listAllPlans(): Promise<StudyPlan[]> {
    const data = await this.storage.readStudyPlans();
    return data.studyPlans.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * 進捗を更新
   */
  async updateProgress(planId: string, progress: number): Promise<StudyPlan> {
    if (progress < 0 || progress > 100) {
      throw new Error('Progress must be between 0 and 100');
    }

    const data = await this.storage.readStudyPlans();
    const planIndex = data.studyPlans.findIndex(plan => plan.id === planId);
    
    if (planIndex === -1) {
      throw new Error('Study plan not found');
    }

    const existingPlan = data.studyPlans[planIndex]!;
    let newStatus = existingPlan.status;

    // 進捗に基づいてステータスを自動更新
    if (progress === 0 && existingPlan.status === PlanStatus.IN_PROGRESS) {
      newStatus = PlanStatus.PLANNING;
    } else if (progress > 0 && progress < 100 && existingPlan.status === PlanStatus.PLANNING) {
      newStatus = PlanStatus.IN_PROGRESS;
    } else if (progress === 100) {
      newStatus = PlanStatus.COMPLETED;
    }

    const updatedPlan: StudyPlan = {
      ...existingPlan,
      progress,
      status: newStatus,
      updatedAt: new Date().toISOString()
    };

    data.studyPlans[planIndex] = updatedPlan;
    await this.storage.writeStudyPlans(data);

    return updatedPlan;
  }

  /**
   * ステータス別の学習計画を取得
   */
  async getPlansByStatus(status: PlanStatus): Promise<StudyPlan[]> {
    const data = await this.storage.readStudyPlans();
    return data.studyPlans
      .filter(plan => plan.status === status)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * 期限が近い学習計画を取得
   */
  async getUpcomingDeadlines(daysAhead: number = 30): Promise<StudyPlan[]> {
    const data = await this.storage.readStudyPlans();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + daysAhead);

    return data.studyPlans
      .filter(plan => {
        if (plan.status === PlanStatus.COMPLETED || plan.status === PlanStatus.CANCELLED) {
          return false;
        }
        const targetDate = new Date(plan.targetDate);
        return targetDate <= cutoffDate;
      })
      .sort((a, b) => new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime());
  }

  /**
   * 資格別の学習計画統計を取得
   */
  async getCertificationPlanStats(): Promise<Array<{
    certificationId: string;
    totalPlans: number;
    activePlans: number;
    completedPlans: number;
    averageProgress: number;
  }>> {
    const data = await this.storage.readStudyPlans();
    const stats = new Map<string, {
      totalPlans: number;
      activePlans: number;
      completedPlans: number;
      totalProgress: number;
    }>();

    data.studyPlans.forEach(plan => {
      const certId = plan.certificationId;
      if (!stats.has(certId)) {
        stats.set(certId, {
          totalPlans: 0,
          activePlans: 0,
          completedPlans: 0,
          totalProgress: 0
        });
      }

      const stat = stats.get(certId)!;
      stat.totalPlans++;
      stat.totalProgress += plan.progress;

      if (plan.status === PlanStatus.COMPLETED) {
        stat.completedPlans++;
      } else if (plan.status === PlanStatus.PLANNING || plan.status === PlanStatus.IN_PROGRESS) {
        stat.activePlans++;
      }
    });

    return Array.from(stats.entries()).map(([certificationId, stat]) => ({
      certificationId,
      totalPlans: stat.totalPlans,
      activePlans: stat.activePlans,
      completedPlans: stat.completedPlans,
      averageProgress: stat.totalPlans > 0 ? Math.round(stat.totalProgress / stat.totalPlans) : 0
    }));
  }

  /**
   * ユーザー別の学習計画統計を取得
   */
  async getUserPlanStats(userId: string): Promise<{
    totalPlans: number;
    activePlans: number;
    completedPlans: number;
    averageProgress: number;
    upcomingDeadlines: number;
  }> {
    const userPlans = await this.getUserPlans(userId);
    const upcomingDeadlines = await this.getUpcomingDeadlines();
    const userUpcomingDeadlines = upcomingDeadlines.filter(plan => plan.userId === userId);

    const activePlans = userPlans.filter(plan => 
      plan.status === PlanStatus.PLANNING || plan.status === PlanStatus.IN_PROGRESS
    );
    const completedPlans = userPlans.filter(plan => plan.status === PlanStatus.COMPLETED);
    const totalProgress = userPlans.reduce((sum, plan) => sum + plan.progress, 0);

    return {
      totalPlans: userPlans.length,
      activePlans: activePlans.length,
      completedPlans: completedPlans.length,
      averageProgress: userPlans.length > 0 ? Math.round(totalProgress / userPlans.length) : 0,
      upcomingDeadlines: userUpcomingDeadlines.length
    };
  }
}