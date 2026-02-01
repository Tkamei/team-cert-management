import { Router, Request, Response } from 'express';
import { CertificationService } from '../services/certification';
import { storage } from '../app';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { CreateCertificationRequest, UpdateCertificationRequest, CertificationFilters } from '../types';
import { logger } from '../utils/logger';

const router = Router();
const certificationService = new CertificationService(storage);

/**
 * 資格一覧取得（フィルター対応）
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const filters: CertificationFilters = {};
    
    // クエリパラメータからフィルターを構築
    if (req.query.category) {
      filters.category = req.query.category as any;
    }
    if (req.query.issuer) {
      filters.issuer = req.query.issuer as string;
    }
    if (req.query.difficulty) {
      const difficulty = parseInt(req.query.difficulty as string);
      if (!isNaN(difficulty) && difficulty >= 1 && difficulty <= 5) {
        filters.difficulty = difficulty;
      }
    }

    const certifications = await certificationService.listCertifications(filters);
    
    res.json({
      success: true,
      data: {
        certifications,
        count: certifications.length
      }
    });
  } catch (error) {
    logger.error('List certifications error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to get certifications',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * 資格検索
 */
router.get('/search', requireAuth, async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Search query is required',
          details: [
            { field: 'q', message: 'Search query parameter is required' }
          ],
          timestamp: new Date().toISOString()
        }
      });
    }

    const certifications = await certificationService.searchCertifications(query.trim());
    
    res.json({
      success: true,
      data: {
        certifications,
        count: certifications.length,
        query: query.trim()
      }
    });
  } catch (error) {
    logger.error('Search certifications error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to search certifications',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * カテゴリ別統計取得
 */
router.get('/stats/categories', requireAuth, async (req: Request, res: Response) => {
  try {
    const stats = await certificationService.getCategoryStats();
    
    res.json({
      success: true,
      data: {
        categoryStats: stats
      }
    });
  } catch (error) {
    logger.error('Get category stats error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to get category statistics',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * 人気資格ランキング取得
 */
router.get('/popular', requireAuth, async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    const popularCertifications = await certificationService.getPopularCertifications(limit);
    
    res.json({
      success: true,
      data: {
        popularCertifications
      }
    });
  } catch (error) {
    logger.error('Get popular certifications error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to get popular certifications',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * 推奨資格取得
 */
router.get('/recommended', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;
    
    const recommendedCertifications = await certificationService.getRecommendedCertifications(userId, limit);
    
    res.json({
      success: true,
      data: {
        recommendedCertifications
      }
    });
  } catch (error) {
    logger.error('Get recommended certifications error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to get recommended certifications',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * 資格作成（管理者のみ）
 */
router.post('/', requireAdmin, async (req: Request, res: Response) => {
  try {
    const certData: CreateCertificationRequest = req.body;
    const userId = req.user!.id;

    // バリデーション
    if (!certData.name || !certData.issuer || !certData.category || 
        certData.difficulty === undefined || !certData.description) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Name, issuer, category, difficulty, and description are required',
          details: [
            ...(certData.name ? [] : [{ field: 'name', message: 'Name is required' }]),
            ...(certData.issuer ? [] : [{ field: 'issuer', message: 'Issuer is required' }]),
            ...(certData.category ? [] : [{ field: 'category', message: 'Category is required' }]),
            ...(certData.difficulty !== undefined ? [] : [{ field: 'difficulty', message: 'Difficulty is required' }]),
            ...(certData.description ? [] : [{ field: 'description', message: 'Description is required' }])
          ],
          timestamp: new Date().toISOString()
        }
      });
    }

    // 難易度の範囲チェック
    if (certData.difficulty < 1 || certData.difficulty > 5) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Difficulty must be between 1 and 5',
          details: [
            { field: 'difficulty', message: 'Difficulty must be between 1 and 5' }
          ],
          timestamp: new Date().toISOString()
        }
      });
    }

    // 有効期限の範囲チェック
    if (certData.validityPeriod !== undefined && certData.validityPeriod <= 0) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validity period must be positive',
          details: [
            { field: 'validityPeriod', message: 'Validity period must be positive' }
          ],
          timestamp: new Date().toISOString()
        }
      });
    }

    const newCertification = await certificationService.createCertification(certData, userId);

    res.status(201).json({
      success: true,
      data: {
        certification: newCertification
      }
    });
  } catch (error: any) {
    logger.error('Create certification error:', error);

    if (error.message === 'Certification with same name and issuer already exists') {
      return res.status(409).json({
        error: {
          code: 'CERTIFICATION_EXISTS',
          message: 'Certification with same name and issuer already exists',
          timestamp: new Date().toISOString()
        }
      });
    }

    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create certification',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * 資格詳細取得
 */
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const certId = req.params.id;
    const certification = await certificationService.getCertification(certId);

    if (!certification) {
      return res.status(404).json({
        error: {
          code: 'CERTIFICATION_NOT_FOUND',
          message: 'Certification not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    res.json({
      success: true,
      data: {
        certification
      }
    });
  } catch (error) {
    logger.error('Get certification error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to get certification',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * 資格更新（管理者のみ）
 */
router.put('/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const certId = req.params.id;
    const certData: UpdateCertificationRequest = req.body;
    const userId = req.user!.id;

    // 難易度の範囲チェック
    if (certData.difficulty !== undefined && (certData.difficulty < 1 || certData.difficulty > 5)) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Difficulty must be between 1 and 5',
          details: [
            { field: 'difficulty', message: 'Difficulty must be between 1 and 5' }
          ],
          timestamp: new Date().toISOString()
        }
      });
    }

    // 有効期限の範囲チェック
    if (certData.validityPeriod !== undefined && certData.validityPeriod <= 0) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validity period must be positive',
          details: [
            { field: 'validityPeriod', message: 'Validity period must be positive' }
          ],
          timestamp: new Date().toISOString()
        }
      });
    }

    const updatedCertification = await certificationService.updateCertification(certId, certData, userId);

    res.json({
      success: true,
      data: {
        certification: updatedCertification
      }
    });
  } catch (error: any) {
    logger.error('Update certification error:', error);

    if (error.message === 'Certification not found') {
      return res.status(404).json({
        error: {
          code: 'CERTIFICATION_NOT_FOUND',
          message: 'Certification not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    if (error.message === 'Certification with same name and issuer already exists') {
      return res.status(409).json({
        error: {
          code: 'CERTIFICATION_EXISTS',
          message: 'Certification with same name and issuer already exists',
          timestamp: new Date().toISOString()
        }
      });
    }

    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to update certification',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * 資格削除（管理者のみ）
 */
router.delete('/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const certId = req.params.id;
    const userId = req.user!.id;

    await certificationService.deleteCertification(certId, userId);

    res.json({
      success: true,
      message: 'Certification deleted successfully'
    });
  } catch (error: any) {
    logger.error('Delete certification error:', error);

    if (error.message === 'Certification not found') {
      return res.status(404).json({
        error: {
          code: 'CERTIFICATION_NOT_FOUND',
          message: 'Certification not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    if (error.message === 'Cannot delete certification with existing study plans or achievements') {
      return res.status(409).json({
        error: {
          code: 'CERTIFICATION_IN_USE',
          message: 'Cannot delete certification with existing study plans or achievements',
          timestamp: new Date().toISOString()
        }
      });
    }

    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to delete certification',
        timestamp: new Date().toISOString()
      }
    });
  }
});

export default router;