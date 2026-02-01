import { v4 as uuidv4 } from 'uuid';
import { JSONStorage } from '../data/storage';
import { 
  Achievement, 
  CreateAchievementRequest, 
  UpdateAchievementRequest,
  AchievementsData 
} from '../types';

export class CertificationHistoryService {
  constructor(private storage: JSONStorage) {}

  /**
   * 資格取得履歴を追加
   */
  async addAchievement(userId: string, achievementData: CreateAchievementRequest): Promise<Achievement> {
    const data = await this.storage.readAchievements();
    
    // 同じユーザーが同じ資格を既に取得していないかチェック（アクティブなもののみ）
    const existingAchievement = data.achievements.find(achievement => 
      achievement.userId === userId && 
      achievement.certificationId === achievementData.certificationId &&
      achievement.isActive
    );
    
    if (existingAchievement) {
      throw new Error('Active achievement for this certification already exists');
    }

    const now = new Date().toISOString();
    const newAchievement: Achievement = {
      id: uuidv4(),
      userId,
      certificationId: achievementData.certificationId,
      achievedDate: achievementData.achievedDate,
      isActive: true,
      createdAt: now,
      updatedAt: now
    };

    // Add optional properties only if they exist
    if (achievementData.certificationNumber) {
      newAchievement.certificationNumber = achievementData.certificationNumber;
    }
    if (achievementData.expiryDate) {
      newAchievement.expiryDate = achievementData.expiryDate;
    }

    data.achievements.push(newAchievement);
    await this.storage.writeAchievements(data);

    return newAchievement;
  }

  /**
   * 資格取得履歴を更新
   */
  async updateAchievement(achievementId: string, achievementData: UpdateAchievementRequest): Promise<Achievement> {
    const data = await this.storage.readAchievements();
    const achievementIndex = data.achievements.findIndex(achievement => achievement.id === achievementId);
    
    if (achievementIndex === -1) {
      throw new Error('Achievement not found');
    }

    const existingAchievement = data.achievements[achievementIndex]!;
    const updatedAchievement: Achievement = {
      ...existingAchievement,
      ...achievementData,
      updatedAt: new Date().toISOString()
    };

    data.achievements[achievementIndex] = updatedAchievement;
    await this.storage.writeAchievements(data);

    return updatedAchievement;
  }

  /**
   * 資格取得履歴を削除
   */
  async deleteAchievement(achievementId: string): Promise<void> {
    const data = await this.storage.readAchievements();
    const achievementIndex = data.achievements.findIndex(achievement => achievement.id === achievementId);
    
    if (achievementIndex === -1) {
      throw new Error('Achievement not found');
    }

    data.achievements.splice(achievementIndex, 1);
    await this.storage.writeAchievements(data);
  }

  /**
   * 資格取得履歴を取得
   */
  async getAchievement(achievementId: string): Promise<Achievement | null> {
    const data = await this.storage.readAchievements();
    return data.achievements.find(achievement => achievement.id === achievementId) || null;
  }

  /**
   * ユーザーの資格取得履歴一覧を取得
   */
  async getUserAchievements(userId: string, activeOnly: boolean = false): Promise<{ success: boolean; data: { achievements: Achievement[] } }> {
    const data = await this.storage.readAchievements();
    const achievements = data.achievements
      .filter(achievement => {
        if (achievement.userId !== userId) return false;
        if (activeOnly && !achievement.isActive) return false;
        return true;
      })
      .sort((a, b) => new Date(b.achievedDate).getTime() - new Date(a.achievedDate).getTime());
    
    return {
      success: true,
      data: { achievements }
    };
  }

  /**
   * 全ての資格取得履歴を取得（管理者用）
   */
  async listAllAchievements(activeOnly: boolean = false): Promise<{ success: boolean; data: { achievements: Achievement[] } }> {
    const data = await this.storage.readAchievements();
    const achievements = data.achievements
      .filter(achievement => activeOnly ? achievement.isActive : true)
      .sort((a, b) => new Date(b.achievedDate).getTime() - new Date(a.achievedDate).getTime());
    
    return {
      success: true,
      data: { achievements }
    };
  }

  /**
   * 有効期限が近い資格を取得
   */
  async getExpiringCertifications(daysAhead: number = 90): Promise<Achievement[]> {
    const data = await this.storage.readAchievements();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + daysAhead);

    return data.achievements
      .filter(achievement => {
        if (!achievement.isActive || !achievement.expiryDate) return false;
        const expiryDate = new Date(achievement.expiryDate);
        return expiryDate <= cutoffDate && expiryDate >= new Date();
      })
      .sort((a, b) => new Date(a.expiryDate!).getTime() - new Date(b.expiryDate!).getTime());
  }

  /**
   * 期限切れの資格を取得
   */
  async getExpiredCertifications(): Promise<Achievement[]> {
    const data = await this.storage.readAchievements();
    const now = new Date();

    return data.achievements
      .filter(achievement => {
        if (!achievement.expiryDate) return false;
        const expiryDate = new Date(achievement.expiryDate);
        return expiryDate < now;
      })
      .sort((a, b) => new Date(b.expiryDate!).getTime() - new Date(a.expiryDate!).getTime());
  }

  /**
   * 資格を無効化（期限切れ時など）
   */
  async deactivateAchievement(achievementId: string): Promise<Achievement> {
    return this.updateAchievement(achievementId, { isActive: false });
  }

  /**
   * 資格を再有効化
   */
  async reactivateAchievement(achievementId: string): Promise<Achievement> {
    return this.updateAchievement(achievementId, { isActive: true });
  }

  /**
   * 資格別の取得統計を取得
   */
  async getCertificationAchievementStats(): Promise<Array<{
    certificationId: string;
    totalAchievements: number;
    activeAchievements: number;
    expiredAchievements: number;
    expiringAchievements: number;
    averageDaysToExpiry: number;
  }>> {
    const data = await this.storage.readAchievements();
    const stats = new Map<string, {
      totalAchievements: number;
      activeAchievements: number;
      expiredAchievements: number;
      expiringAchievements: number;
      totalDaysToExpiry: number;
      expiryCount: number;
    }>();

    const now = new Date();
    const expiryThreshold = new Date();
    expiryThreshold.setDate(now.getDate() + 90);

    data.achievements.forEach(achievement => {
      const certId = achievement.certificationId;
      if (!stats.has(certId)) {
        stats.set(certId, {
          totalAchievements: 0,
          activeAchievements: 0,
          expiredAchievements: 0,
          expiringAchievements: 0,
          totalDaysToExpiry: 0,
          expiryCount: 0
        });
      }

      const stat = stats.get(certId)!;
      stat.totalAchievements++;

      if (achievement.isActive) {
        stat.activeAchievements++;
      }

      if (achievement.expiryDate) {
        const expiryDate = new Date(achievement.expiryDate);
        const daysToExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        stat.totalDaysToExpiry += daysToExpiry;
        stat.expiryCount++;

        if (expiryDate < now) {
          stat.expiredAchievements++;
        } else if (expiryDate <= expiryThreshold) {
          stat.expiringAchievements++;
        }
      }
    });

    return Array.from(stats.entries()).map(([certificationId, stat]) => ({
      certificationId,
      totalAchievements: stat.totalAchievements,
      activeAchievements: stat.activeAchievements,
      expiredAchievements: stat.expiredAchievements,
      expiringAchievements: stat.expiringAchievements,
      averageDaysToExpiry: stat.expiryCount > 0 ? Math.round(stat.totalDaysToExpiry / stat.expiryCount) : 0
    }));
  }

  /**
   * ユーザー別の取得統計を取得
   */
  async getUserAchievementStats(userId: string): Promise<{
    totalAchievements: number;
    activeAchievements: number;
    expiredAchievements: number;
    expiringAchievements: number;
    recentAchievements: Achievement[];
  }> {
    const userAchievementsResult = await this.getUserAchievements(userId);
    const userAchievements = userAchievementsResult.data.achievements;
    const expiringAchievements = await this.getExpiringCertifications();
    const userExpiringAchievements = expiringAchievements.filter(a => a.userId === userId);
    
    const now = new Date();
    const expiredAchievements = userAchievements.filter(achievement => {
      if (!achievement.expiryDate) return false;
      return new Date(achievement.expiryDate) < now;
    });

    const recentAchievements = userAchievements
      .filter(achievement => achievement.isActive)
      .slice(0, 5);

    return {
      totalAchievements: userAchievements.length,
      activeAchievements: userAchievements.filter(a => a.isActive).length,
      expiredAchievements: expiredAchievements.length,
      expiringAchievements: userExpiringAchievements.length,
      recentAchievements
    };
  }

  /**
   * 期間別の取得履歴を取得
   */
  async getAchievementsByPeriod(startDate: string, endDate: string): Promise<Achievement[]> {
    const data = await this.storage.readAchievements();
    const start = new Date(startDate);
    const end = new Date(endDate);

    return data.achievements
      .filter(achievement => {
        const achievedDate = new Date(achievement.achievedDate);
        return achievedDate >= start && achievedDate <= end;
      })
      .sort((a, b) => new Date(b.achievedDate).getTime() - new Date(a.achievedDate).getTime());
  }

  /**
   * 資格の更新履歴を取得（同じ資格の複数取得）
   */
  async getCertificationRenewalHistory(userId: string, certificationId: string): Promise<Achievement[]> {
    const data = await this.storage.readAchievements();
    return data.achievements
      .filter(achievement => 
        achievement.userId === userId && 
        achievement.certificationId === certificationId
      )
      .sort((a, b) => new Date(b.achievedDate).getTime() - new Date(a.achievedDate).getTime());
  }

  /**
   * 自動期限切れ処理
   */
  async processExpiredCertifications(): Promise<{
    processedCount: number;
    expiredAchievements: Achievement[];
  }> {
    const data = await this.storage.readAchievements();
    const now = new Date();
    const expiredAchievements: Achievement[] = [];
    let processedCount = 0;

    for (let i = 0; i < data.achievements.length; i++) {
      const achievement = data.achievements[i]!;
      
      if (achievement.isActive && achievement.expiryDate) {
        const expiryDate = new Date(achievement.expiryDate);
        if (expiryDate < now) {
          data.achievements[i] = {
            ...achievement,
            isActive: false,
            updatedAt: now.toISOString()
          };
          expiredAchievements.push(data.achievements[i]!);
          processedCount++;
        }
      }
    }

    if (processedCount > 0) {
      await this.storage.writeAchievements(data);
    }

    return {
      processedCount,
      expiredAchievements
    };
  }
}