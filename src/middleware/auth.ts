import { Request, Response, NextFunction } from 'express';
import { SimpleAuthenticationService, SimpleAuthorizationService } from '../services/auth';
import { storage } from '../app';
import { UserRole } from '../types';

// セッション情報をRequestに追加
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name: string;
        role: UserRole;
        requiresPasswordChange: boolean;
        createdAt: string;
        updatedAt: string;
        lastLoginAt?: string;
      };
      sessionId?: string;
    }
  }
}

/**
 * 認証が必要なエンドポイント用のミドルウェア
 */
export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = req.headers.authorization?.replace('Bearer ', '') || (req.session as any).sessionId;

    if (!sessionId) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          timestamp: new Date().toISOString()
        }
      });
    }

    const authService = new SimpleAuthenticationService(storage);
    const user = await authService.validateSession(sessionId);

    if (!user) {
      return res.status(401).json({
        error: {
          code: 'INVALID_SESSION',
          message: 'Invalid or expired session',
          timestamp: new Date().toISOString()
        }
      });
    }

    // リクエストオブジェクトにユーザー情報を追加
    req.user = user;
    req.sessionId = sessionId;

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Authentication error',
        timestamp: new Date().toISOString()
      }
    });
  }
};

/**
 * 管理者権限が必要なエンドポイント用のミドルウェア
 */
export const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // まず認証チェック
    await new Promise<void>((resolve, reject) => {
      requireAuth(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    if (!req.user) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          timestamp: new Date().toISOString()
        }
      });
    }

    if (req.user.role !== UserRole.ADMIN) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Admin privileges required',
          timestamp: new Date().toISOString()
        }
      });
    }

    next();
  } catch (error) {
    console.error('Admin middleware error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Authorization error',
        timestamp: new Date().toISOString()
      }
    });
  }
};

/**
 * 特定のリソースに対する権限チェック
 */
export const requirePermission = (resource: string, action: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sessionId = req.headers.authorization?.replace('Bearer ', '') || (req.session as any).sessionId;

      if (!sessionId) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
            timestamp: new Date().toISOString()
          }
        });
      }

      const authzService = new SimpleAuthorizationService(storage);
      const hasPermission = await authzService.hasPermission(sessionId, resource, action);

      if (!hasPermission) {
        return res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: `Permission denied for ${action} on ${resource}`,
            timestamp: new Date().toISOString()
          }
        });
      }

      next();
    } catch (error) {
      console.error('Permission middleware error:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Permission check error',
          timestamp: new Date().toISOString()
        }
      });
    }
  };
};

/**
 * パスワード変更が必要かチェック
 */
export const checkPasswordChangeRequired = (req: Request, res: Response, next: NextFunction) => {
  if (req.user?.requiresPasswordChange && req.path !== '/api/auth/change-password') {
    return res.status(403).json({
      error: {
        code: 'PASSWORD_CHANGE_REQUIRED',
        message: 'Password change required before accessing other resources',
        timestamp: new Date().toISOString()
      }
    });
  }

  next();
};