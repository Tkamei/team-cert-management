import { Router, Request, Response } from 'express';
import { SimpleAuthenticationService } from '../services/auth';
import { storage } from '../app';
import { requireAuth } from '../middleware/auth';
import { LoginRequest, ChangePasswordRequest } from '../types';
import { logger } from '../utils/logger';

const router = Router();
const authService = new SimpleAuthenticationService(storage);

/**
 * ログイン
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const loginData: LoginRequest = req.body;

    // バリデーション
    if (!loginData.email || !loginData.password) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email and password are required',
          details: [
            ...(loginData.email ? [] : [{ field: 'email', message: 'Email is required' }]),
            ...(loginData.password ? [] : [{ field: 'password', message: 'Password is required' }])
          ],
          timestamp: new Date().toISOString()
        }
      });
    }

    const result = await authService.login(loginData);

    // セッションIDをセッションに保存
    (req.session as any).sessionId = result.sessionId;

    res.json({
      success: true,
      data: {
        user: result.user,
        requiresPasswordChange: result.requiresPasswordChange,
        sessionId: result.sessionId
      }
    });
  } catch (error: any) {
    logger.error('Login error:', error);
    
    if (error.message === 'Invalid credentials') {
      return res.status(401).json({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
          timestamp: new Date().toISOString()
        }
      });
    }

    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Login failed',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * ログアウト
 */
router.post('/logout', requireAuth, async (req: Request, res: Response) => {
  try {
    const sessionId = req.sessionId;

    if (sessionId) {
      await authService.logout(sessionId);
    }

    // セッションを破棄
    req.session.destroy((err) => {
      if (err) {
        logger.error('Session destroy error:', err);
      }
    });

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Logout failed',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * パスワード変更
 */
router.post('/change-password', requireAuth, async (req: Request, res: Response) => {
  try {
    const changePasswordData: ChangePasswordRequest = req.body;
    const userId = req.user!.id;

    // バリデーション
    if (!changePasswordData.oldPassword || !changePasswordData.newPassword) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Old password and new password are required',
          details: [
            ...(changePasswordData.oldPassword ? [] : [{ field: 'oldPassword', message: 'Old password is required' }]),
            ...(changePasswordData.newPassword ? [] : [{ field: 'newPassword', message: 'New password is required' }])
          ],
          timestamp: new Date().toISOString()
        }
      });
    }

    // パスワードの強度チェック
    if (changePasswordData.newPassword.length < 6) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Password must be at least 6 characters long',
          details: [
            { field: 'newPassword', message: 'Password must be at least 6 characters long' }
          ],
          timestamp: new Date().toISOString()
        }
      });
    }

    await authService.changePassword(userId, changePasswordData);

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error: any) {
    logger.error('Change password error:', error);

    if (error.message === 'Current password is incorrect') {
      return res.status(400).json({
        error: {
          code: 'INVALID_PASSWORD',
          message: 'Current password is incorrect',
          timestamp: new Date().toISOString()
        }
      });
    }

    if (error.message === 'User not found') {
      return res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Password change failed',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * 現在のユーザー情報取得
 */
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      data: {
        user: req.user
      }
    });
  } catch (error) {
    logger.error('Get current user error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to get user information',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * セッション検証
 */
router.get('/validate', async (req: Request, res: Response) => {
  try {
    const sessionId = req.headers.authorization?.replace('Bearer ', '') || (req.session as any).sessionId;

    if (!sessionId) {
      return res.status(401).json({
        error: {
          code: 'NO_SESSION',
          message: 'No session found',
          timestamp: new Date().toISOString()
        }
      });
    }

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

    res.json({
      success: true,
      data: {
        user,
        valid: true
      }
    });
  } catch (error) {
    logger.error('Session validation error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Session validation failed',
        timestamp: new Date().toISOString()
      }
    });
  }
});

export default router;