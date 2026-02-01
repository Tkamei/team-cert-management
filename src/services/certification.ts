import { v4 as uuidv4 } from 'uuid';
import { JSONStorage } from '../data/storage';
import { 
  Certification, 
  CertificationCategory,
  CreateCertificationRequest,
  UpdateCertificationRequest,
  CertificationFilters
} from '../types';
import { logger, logUserAction } from '../utils/logger';

export class CertificationService {
  constructor(private storage: JSONStorage) {}

  /**
   * 資格作成（管理者のみ）
   */
  async createCertification(certData: CreateCertificationRequest, userId?: string): Promise<Certification> {
    try {
      const certificationsData = await this.storage.readCertifications();
      
      // 同名の資格の重複チェック
      const existingCert = certificationsData.certifications.find(c => 
        c.name === certData.name && c.issuer === certData.issuer
      );
      if (existingCert) {
        throw new Error('Certification with same name and issuer already exists');
      }

      const newCertification: Certification = {
        id: uuidv4(),
        name: certData.name,
        issuer: certData.issuer,
        category: certData.category,
        difficulty: certData.difficulty,
        description: certData.description,
        ...(certData.validityPeriod !== undefined && { validityPeriod: certData.validityPeriod }),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      certificationsData.certifications.push(newCertification);
      await this.storage.writeCertifications(certificationsData);

      if (userId) {
        logUserAction(userId, 'create_certification', 'certifications', { 
          certificationId: newCertification.id,
          name: newCertification.name 
        });
      }

      logger.info('Certification created', { 
        certificationId: newCertification.id, 
        name: newCertification.name,
        category: newCertification.category 
      });

      return newCertification;
    } catch (error) {
      logger.error('Certification creation failed:', error);
      throw error;
    }
  }

  /**
   * 資格更新（管理者のみ）
   */
  async updateCertification(certId: string, certData: UpdateCertificationRequest, userId?: string): Promise<Certification> {
    try {
      const certificationsData = await this.storage.readCertifications();
      const certIndex = certificationsData.certifications.findIndex(c => c.id === certId);

      if (certIndex === -1) {
        throw new Error('Certification not found');
      }

      const certification = certificationsData.certifications[certIndex];
      if (!certification) {
        throw new Error('Certification not found');
      }

      // 同名の資格の重複チェック（変更する場合）
      if ((certData.name || certData.issuer) && 
          (certData.name !== certification.name || certData.issuer !== certification.issuer)) {
        const existingCert = certificationsData.certifications.find(c => 
          c.name === (certData.name || certification.name) && 
          c.issuer === (certData.issuer || certification.issuer) &&
          c.id !== certId
        );
        if (existingCert) {
          throw new Error('Certification with same name and issuer already exists');
        }
      }

      // 資格情報を更新
      if (certData.name) certification.name = certData.name;
      if (certData.issuer) certification.issuer = certData.issuer;
      if (certData.category) certification.category = certData.category;
      if (certData.difficulty !== undefined) certification.difficulty = certData.difficulty;
      if (certData.description) certification.description = certData.description;
      if (certData.validityPeriod !== undefined) certification.validityPeriod = certData.validityPeriod;
      certification.updatedAt = new Date().toISOString();

      await this.storage.writeCertifications(certificationsData);

      if (userId) {
        logUserAction(userId, 'update_certification', 'certifications', { 
          certificationId: certId,
          changes: certData 
        });
      }

      return certification;
    } catch (error) {
      logger.error('Certification update failed:', error);
      throw error;
    }
  }

  /**
   * 資格削除（管理者のみ）
   */
  async deleteCertification(certId: string, userId?: string): Promise<void> {
    try {
      const certificationsData = await this.storage.readCertifications();
      const certIndex = certificationsData.certifications.findIndex(c => c.id === certId);

      if (certIndex === -1) {
        throw new Error('Certification not found');
      }

      const certification = certificationsData.certifications[certIndex];
      if (!certification) {
        throw new Error('Certification not found');
      }

      // 関連する学習計画や取得履歴があるかチェック
      const studyPlansData = await this.storage.readStudyPlans();
      const relatedPlans = studyPlansData.studyPlans.filter(p => p.certificationId === certId);

      const achievementsData = await this.storage.readAchievements();
      const relatedAchievements = achievementsData.achievements.filter(a => a.certificationId === certId);

      if (relatedPlans.length > 0 || relatedAchievements.length > 0) {
        throw new Error('Cannot delete certification with existing study plans or achievements');
      }

      certificationsData.certifications.splice(certIndex, 1);
      await this.storage.writeCertifications(certificationsData);

      if (userId) {
        logUserAction(userId, 'delete_certification', 'certifications', { 
          certificationId: certId,
          name: certification.name 
        });
      }
    } catch (error) {
      logger.error('Certification deletion failed:', error);
      throw error;
    }
  }

  /**
   * 資格取得
   */
  async getCertification(certId: string): Promise<Certification | null> {
    try {
      const certificationsData = await this.storage.readCertifications();
      const certification = certificationsData.certifications.find(c => c.id === certId);
      return certification || null;
    } catch (error) {
      logger.error('Get certification failed:', error);
      return null;
    }
  }

  /**
   * 資格一覧取得（フィルター対応）
   */
  async listCertifications(filters?: CertificationFilters): Promise<Certification[]> {
    try {
      const certificationsData = await this.storage.readCertifications();
      let certifications = certificationsData.certifications;

      // フィルター適用
      if (filters) {
        if (filters.category) {
          certifications = certifications.filter(c => c.category === filters.category);
        }
        if (filters.issuer) {
          certifications = certifications.filter(c => 
            c.issuer.toLowerCase().includes(filters.issuer!.toLowerCase())
          );
        }
        if (filters.difficulty !== undefined) {
          certifications = certifications.filter(c => c.difficulty === filters.difficulty);
        }
      }

      // 名前順でソート
      return certifications.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      logger.error('List certifications failed:', error);
      throw error;
    }
  }

  /**
   * 資格検索
   */
  async searchCertifications(query: string): Promise<Certification[]> {
    try {
      const certificationsData = await this.storage.readCertifications();
      const searchTerm = query.toLowerCase();

      const matchedCertifications = certificationsData.certifications.filter(cert => 
        cert.name.toLowerCase().includes(searchTerm) ||
        cert.issuer.toLowerCase().includes(searchTerm) ||
        cert.description.toLowerCase().includes(searchTerm) ||
        cert.category.toLowerCase().includes(searchTerm)
      );

      // 関連度でソート（名前に含まれるものを優先）
      return matchedCertifications.sort((a, b) => {
        const aNameMatch = a.name.toLowerCase().includes(searchTerm);
        const bNameMatch = b.name.toLowerCase().includes(searchTerm);
        
        if (aNameMatch && !bNameMatch) return -1;
        if (!aNameMatch && bNameMatch) return 1;
        
        return a.name.localeCompare(b.name);
      });
    } catch (error) {
      logger.error('Search certifications failed:', error);
      throw error;
    }
  }

  /**
   * カテゴリ別統計取得
   */
  async getCategoryStats(): Promise<Array<{ category: CertificationCategory; count: number }>> {
    try {
      const certificationsData = await this.storage.readCertifications();
      const stats = new Map<CertificationCategory, number>();

      // 各カテゴリの初期化
      Object.values(CertificationCategory).forEach(category => {
        stats.set(category, 0);
      });

      // カウント
      certificationsData.certifications.forEach(cert => {
        const currentCount = stats.get(cert.category) || 0;
        stats.set(cert.category, currentCount + 1);
      });

      return Array.from(stats.entries()).map(([category, count]) => ({
        category,
        count
      }));
    } catch (error) {
      logger.error('Get category stats failed:', error);
      throw error;
    }
  }

  /**
   * 人気資格ランキング取得（取得履歴ベース）
   */
  async getPopularCertifications(limit: number = 10): Promise<Array<{ certification: Certification; achievementCount: number }>> {
    try {
      const certificationsData = await this.storage.readCertifications();
      const achievementsData = await this.storage.readAchievements();

      // 資格ごとの取得数をカウント
      const achievementCounts = new Map<string, number>();
      achievementsData.achievements.forEach(achievement => {
        const currentCount = achievementCounts.get(achievement.certificationId) || 0;
        achievementCounts.set(achievement.certificationId, currentCount + 1);
      });

      // 資格情報と取得数を結合
      const popularCertifications = certificationsData.certifications
        .map(cert => ({
          certification: cert,
          achievementCount: achievementCounts.get(cert.id) || 0
        }))
        .sort((a, b) => b.achievementCount - a.achievementCount)
        .slice(0, limit);

      return popularCertifications;
    } catch (error) {
      logger.error('Get popular certifications failed:', error);
      throw error;
    }
  }

  /**
   * 推奨資格取得（ユーザーの取得履歴ベース）
   */
  async getRecommendedCertifications(userId: string, limit: number = 5): Promise<Certification[]> {
    try {
      const certificationsData = await this.storage.readCertifications();
      const achievementsData = await this.storage.readAchievements();

      // ユーザーの取得済み資格を取得
      const userAchievements = achievementsData.achievements.filter(a => a.userId === userId);
      const achievedCertIds = new Set(userAchievements.map(a => a.certificationId));

      // ユーザーが取得した資格のカテゴリを分析
      const userCategories = new Set<CertificationCategory>();
      userAchievements.forEach(achievement => {
        const cert = certificationsData.certifications.find(c => c.id === achievement.certificationId);
        if (cert) {
          userCategories.add(cert.category);
        }
      });

      // 未取得の資格から推奨を選択
      const unachievedCertifications = certificationsData.certifications.filter(cert => 
        !achievedCertIds.has(cert.id)
      );

      // 同じカテゴリの資格を優先し、難易度でソート
      const recommendedCertifications = unachievedCertifications
        .sort((a, b) => {
          const aCategoryMatch = userCategories.has(a.category);
          const bCategoryMatch = userCategories.has(b.category);
          
          if (aCategoryMatch && !bCategoryMatch) return -1;
          if (!aCategoryMatch && bCategoryMatch) return 1;
          
          // 同じカテゴリの場合は難易度でソート
          return a.difficulty - b.difficulty;
        })
        .slice(0, limit);

      return recommendedCertifications;
    } catch (error) {
      logger.error('Get recommended certifications failed:', error);
      throw error;
    }
  }
}