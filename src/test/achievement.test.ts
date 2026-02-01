import { CertificationHistoryService } from '../services/achievement';
import { JSONStorage } from '../data/storage';

describe('CertificationHistoryService', () => {
  const testDataDir = './test-data-achievement';
  let storage: JSONStorage;
  let achievementService: CertificationHistoryService;

  beforeEach(async () => {
    storage = new JSONStorage(testDataDir);
    await storage.initializeDataDirectory();
    achievementService = new CertificationHistoryService(storage);
  });

  describe('addAchievement', () => {
    it('should add a new achievement', async () => {
      const userId = 'user-1';
      const achievementData = {
        certificationId: 'cert-1',
        achievedDate: '2024-01-15',
        certificationNumber: 'CERT-123456',
        expiryDate: '2027-01-15'
      };

      const achievement = await achievementService.addAchievement(userId, achievementData);

      expect(achievement.userId).toBe(userId);
      expect(achievement.certificationId).toBe(achievementData.certificationId);
      expect(achievement.achievedDate).toBe(achievementData.achievedDate);
      expect(achievement.certificationNumber).toBe(achievementData.certificationNumber);
      expect(achievement.expiryDate).toBe(achievementData.expiryDate);
      expect(achievement.isActive).toBe(true);
      expect(achievement.id).toBeDefined();
      expect(achievement.createdAt).toBeDefined();
      expect(achievement.updatedAt).toBeDefined();
    });

    it('should not allow duplicate active achievements for same certification', async () => {
      const userId = 'user-1';
      const achievementData = {
        certificationId: 'cert-1',
        achievedDate: '2024-01-15'
      };

      await achievementService.addAchievement(userId, achievementData);

      await expect(achievementService.addAchievement(userId, achievementData))
        .rejects.toThrow('Active achievement for this certification already exists');
    });

    it('should allow multiple achievements for different certifications', async () => {
      const userId = 'user-1';
      const achievementData1 = {
        certificationId: 'cert-1',
        achievedDate: '2024-01-15'
      };
      const achievementData2 = {
        certificationId: 'cert-2',
        achievedDate: '2024-02-15'
      };

      const achievement1 = await achievementService.addAchievement(userId, achievementData1);
      const achievement2 = await achievementService.addAchievement(userId, achievementData2);

      expect(achievement1.certificationId).toBe('cert-1');
      expect(achievement2.certificationId).toBe('cert-2');
    });

    it('should allow achievement without expiry date', async () => {
      const userId = 'user-1';
      const achievementData = {
        certificationId: 'cert-1',
        achievedDate: '2024-01-15'
      };

      const achievement = await achievementService.addAchievement(userId, achievementData);

      expect(achievement.expiryDate).toBeUndefined();
      expect(achievement.isActive).toBe(true);
    });
  });

  describe('updateAchievement', () => {
    it('should update achievement information', async () => {
      const userId = 'user-1';
      const achievementData = {
        certificationId: 'cert-1',
        achievedDate: '2024-01-15',
        certificationNumber: 'CERT-123456'
      };

      const achievement = await achievementService.addAchievement(userId, achievementData);

      const updateData = {
        certificationNumber: 'CERT-789012',
        expiryDate: '2027-01-15'
      };

      const updatedAchievement = await achievementService.updateAchievement(achievement.id, updateData);

      expect(updatedAchievement.certificationNumber).toBe(updateData.certificationNumber);
      expect(updatedAchievement.expiryDate).toBe(updateData.expiryDate);
      expect(updatedAchievement.achievedDate).toBe(achievementData.achievedDate); // 変更されていない
      expect(updatedAchievement.updatedAt).not.toBe(achievement.updatedAt);
    });

    it('should throw error when updating non-existent achievement', async () => {
      const updateData = {
        certificationNumber: 'CERT-789012'
      };

      await expect(achievementService.updateAchievement('non-existent-id', updateData))
        .rejects.toThrow('Achievement not found');
    });
  });

  describe('deleteAchievement', () => {
    it('should delete achievement', async () => {
      const userId = 'user-1';
      const achievementData = {
        certificationId: 'cert-1',
        achievedDate: '2024-01-15'
      };

      const achievement = await achievementService.addAchievement(userId, achievementData);

      await achievementService.deleteAchievement(achievement.id);

      const deletedAchievement = await achievementService.getAchievement(achievement.id);
      expect(deletedAchievement).toBeNull();
    });

    it('should throw error when deleting non-existent achievement', async () => {
      await expect(achievementService.deleteAchievement('non-existent-id'))
        .rejects.toThrow('Achievement not found');
    });
  });

  describe('getUserAchievements', () => {
    beforeEach(async () => {
      // テスト用の取得履歴を複数作成
      const achievements = [
        {
          userId: 'user-1',
          certificationId: 'cert-1',
          achievedDate: '2024-01-15',
          isActive: true
        },
        {
          userId: 'user-1',
          certificationId: 'cert-2',
          achievedDate: '2024-02-15',
          isActive: false
        },
        {
          userId: 'user-2',
          certificationId: 'cert-3',
          achievedDate: '2024-03-15',
          isActive: true
        }
      ];

      for (const achievement of achievements) {
        await achievementService.addAchievement(achievement.userId, {
          certificationId: achievement.certificationId,
          achievedDate: achievement.achievedDate
        });
        
        // 非アクティブにする場合
        if (!achievement.isActive) {
          const userAchievements = await achievementService.getUserAchievements(achievement.userId);
          const targetAchievement = userAchievements.find(a => a.certificationId === achievement.certificationId);
          if (targetAchievement) {
            await achievementService.deactivateAchievement(targetAchievement.id);
          }
        }
      }
    });

    it('should return achievements for specific user', async () => {
      const user1Achievements = await achievementService.getUserAchievements('user-1');
      const user2Achievements = await achievementService.getUserAchievements('user-2');

      expect(user1Achievements).toHaveLength(2);
      expect(user2Achievements).toHaveLength(1);

      user1Achievements.forEach(achievement => {
        expect(achievement.userId).toBe('user-1');
      });

      user2Achievements.forEach(achievement => {
        expect(achievement.userId).toBe('user-2');
      });
    });

    it('should filter by active status when requested', async () => {
      const allAchievements = await achievementService.getUserAchievements('user-1', false);
      const activeAchievements = await achievementService.getUserAchievements('user-1', true);

      expect(allAchievements).toHaveLength(2);
      expect(activeAchievements).toHaveLength(1);
      expect(activeAchievements[0]?.isActive).toBe(true);
    });

    it('should return empty array for user with no achievements', async () => {
      const achievements = await achievementService.getUserAchievements('user-3');
      expect(achievements).toHaveLength(0);
    });
  });

  describe('getExpiringCertifications', () => {
    beforeEach(async () => {
      const userId = 'user-1';
      const now = new Date();
      
      // 近い期限の資格
      const nearExpiry = new Date(now);
      nearExpiry.setDate(now.getDate() + 30);
      
      // 遠い期限の資格
      const farExpiry = new Date(now);
      farExpiry.setDate(now.getDate() + 120);

      await achievementService.addAchievement(userId, {
        certificationId: 'cert-1',
        achievedDate: '2024-01-15',
        expiryDate: nearExpiry.toISOString().split('T')[0]!
      });

      await achievementService.addAchievement(userId, {
        certificationId: 'cert-2',
        achievedDate: '2024-02-15',
        expiryDate: farExpiry.toISOString().split('T')[0]!
      });

      // 期限なしの資格
      await achievementService.addAchievement(userId, {
        certificationId: 'cert-3',
        achievedDate: '2024-03-15'
      });
    });

    it('should return certifications expiring within specified days', async () => {
      const expiringAchievements = await achievementService.getExpiringCertifications(90);
      expect(expiringAchievements).toHaveLength(1);
      expect(expiringAchievements[0]?.certificationId).toBe('cert-1');
    });

    it('should return all expiring certifications within extended period', async () => {
      const expiringAchievements = await achievementService.getExpiringCertifications(150);
      expect(expiringAchievements).toHaveLength(2);
    });

    it('should not return certifications without expiry date', async () => {
      const expiringAchievements = await achievementService.getExpiringCertifications(365);
      expect(expiringAchievements.every(a => a.expiryDate)).toBe(true);
    });
  });

  describe('deactivateAchievement and reactivateAchievement', () => {
    it('should deactivate and reactivate achievement', async () => {
      const userId = 'user-1';
      const achievementData = {
        certificationId: 'cert-1',
        achievedDate: '2024-01-15'
      };

      const achievement = await achievementService.addAchievement(userId, achievementData);
      expect(achievement.isActive).toBe(true);

      // 無効化
      const deactivatedAchievement = await achievementService.deactivateAchievement(achievement.id);
      expect(deactivatedAchievement.isActive).toBe(false);

      // 再有効化
      const reactivatedAchievement = await achievementService.reactivateAchievement(achievement.id);
      expect(reactivatedAchievement.isActive).toBe(true);
    });
  });

  describe('getUserAchievementStats', () => {
    it('should return correct user statistics', async () => {
      const userId = 'user-1';
      const now = new Date();
      
      // アクティブな資格
      await achievementService.addAchievement(userId, {
        certificationId: 'cert-1',
        achievedDate: '2024-01-15'
      });

      // 期限切れの資格
      const expiredDate = new Date(now);
      expiredDate.setDate(now.getDate() - 30);
      
      const expiredAchievement = await achievementService.addAchievement(userId, {
        certificationId: 'cert-2',
        achievedDate: '2023-01-15',
        expiryDate: expiredDate.toISOString().split('T')[0]!
      });

      // 期限が近い資格
      const nearExpiry = new Date(now);
      nearExpiry.setDate(now.getDate() + 30);
      
      await achievementService.addAchievement(userId, {
        certificationId: 'cert-3',
        achievedDate: '2024-03-15',
        expiryDate: nearExpiry.toISOString().split('T')[0]!
      });

      const stats = await achievementService.getUserAchievementStats(userId);

      expect(stats.totalAchievements).toBe(3);
      expect(stats.activeAchievements).toBe(3);
      expect(stats.expiredAchievements).toBe(1);
      expect(stats.expiringAchievements).toBe(1);
      expect(stats.recentAchievements).toHaveLength(3);
    });
  });

  describe('processExpiredCertifications', () => {
    it('should automatically deactivate expired certifications', async () => {
      const userId = 'user-1';
      const now = new Date();
      
      // 期限切れの資格
      const expiredDate = new Date(now);
      expiredDate.setDate(now.getDate() - 30);
      
      const achievement = await achievementService.addAchievement(userId, {
        certificationId: 'cert-1',
        achievedDate: '2023-01-15',
        expiryDate: expiredDate.toISOString().split('T')[0]!
      });

      expect(achievement.isActive).toBe(true);

      // 期限切れ処理を実行
      const result = await achievementService.processExpiredCertifications();

      expect(result.processedCount).toBe(1);
      expect(result.expiredAchievements).toHaveLength(1);
      expect(result.expiredAchievements[0]?.id).toBe(achievement.id);
      expect(result.expiredAchievements[0]?.isActive).toBe(false);
    });

    it('should not affect non-expired certifications', async () => {
      const userId = 'user-1';
      const now = new Date();
      
      // 有効な資格
      const validDate = new Date(now);
      validDate.setDate(now.getDate() + 30);
      
      const achievement = await achievementService.addAchievement(userId, {
        certificationId: 'cert-1',
        achievedDate: '2024-01-15',
        expiryDate: validDate.toISOString().split('T')[0]!
      });

      // 期限切れ処理を実行
      const result = await achievementService.processExpiredCertifications();

      expect(result.processedCount).toBe(0);
      expect(result.expiredAchievements).toHaveLength(0);

      // 資格は依然としてアクティブ
      const updatedAchievement = await achievementService.getAchievement(achievement.id);
      expect(updatedAchievement?.isActive).toBe(true);
    });
  });
});