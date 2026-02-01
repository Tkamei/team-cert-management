import { Router, Request, Response } from 'express';
import { UserManagementService } from '../services/auth';
import { storage } from '../app';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { CreateUserRequest, UpdateUserRequest } from '../types';
import { logger } from '../utils/logger';

const router = Router();
const userService = new UserManagementService(storage);

/**
 * ユーザー一覧取得（管理者のみ）
 */
router.get('/', requireAdmin, async (req: Request, res: Response) => {
  try {
    const users = await userService.listUsers();
    
    res.json({
      success: true,
      data: {
        users
      }
    });
  } catch (error) {
    logger.error('List users error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to get users',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * ユーザー作成（管理者のみ）
 */
router.post('/', requireAdmin, async (req: Request, res: Response) => {
  try {
    const userData: CreateUserRequest = req.body;

    // バリデーション
    if (!userData.email || !userData.name || !userData.role) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email, name, and role are required',
          details: [
            ...(userData.email ? [] : [{ field: 'email', message: 'Email is required' }]),
            ...(userData.name ? [] : [{ field: 'name', message: 'Name is required' }]),
            ...(userData.role ? [] : [{ field: 'role', message: 'Role is required' }])
          ],
          timestamp: new Date().toISOString()
        }
      });
    }

    // メールアドレスの形式チェック
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userData.email)) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid email format',
          details: [
            { field: 'email', message: 'Invalid email format' }
          ],
          timestamp: new Date().toISOString()
        }
      });
    }

    const newUser = await userService.createUser(userData);

    res.status(201).json({
      success: true,
      data: {
        user: newUser
      }
    });
  } catch (error: any) {
    logger.error('Create user error:', error);

    if (error.message === 'Email already exists') {
      return res.status(409).json({
        error: {
          code: 'EMAIL_EXISTS',
          message: 'Email address already exists',
          timestamp: new Date().toISOString()
        }
      });
    }

    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create user',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * ユーザー詳細取得
 */
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.params.id;
    const currentUser = req.user!;

    // 管理者または本人のみアクセス可能
    if (currentUser.role !== 'admin' && currentUser.id !== userId) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied',
          timestamp: new Date().toISOString()
        }
      });
    }

    const user = await userService.getUser(userId);

    if (!user) {
      return res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    res.json({
      success: true,
      data: {
        user
      }
    });
  } catch (error) {
    logger.error('Get user error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to get user',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * ユーザー更新
 */
router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.params.id;
    const userData: UpdateUserRequest = req.body;
    const currentUser = req.user!;

    // 管理者または本人のみ更新可能
    if (currentUser.role !== 'admin' && currentUser.id !== userId) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied',
          timestamp: new Date().toISOString()
        }
      });
    }

    // 一般ユーザーは自分の権限を変更できない
    if (currentUser.role !== 'admin' && userData.role) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Cannot change your own role',
          timestamp: new Date().toISOString()
        }
      });
    }

    // メールアドレスの形式チェック
    if (userData.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(userData.email)) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid email format',
            details: [
              { field: 'email', message: 'Invalid email format' }
            ],
            timestamp: new Date().toISOString()
          }
        });
      }
    }

    const updatedUser = await userService.updateUser(userId, userData);

    res.json({
      success: true,
      data: {
        user: updatedUser
      }
    });
  } catch (error: any) {
    logger.error('Update user error:', error);

    if (error.message === 'User not found') {
      return res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    if (error.message === 'Email already exists') {
      return res.status(409).json({
        error: {
          code: 'EMAIL_EXISTS',
          message: 'Email address already exists',
          timestamp: new Date().toISOString()
        }
      });
    }

    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to update user',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * ユーザー削除（管理者のみ）
 */
router.delete('/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const userId = req.params.id;
    const currentUser = req.user!;

    // 自分自身は削除できない
    if (currentUser.id === userId) {
      return res.status(400).json({
        error: {
          code: 'CANNOT_DELETE_SELF',
          message: 'Cannot delete your own account',
          timestamp: new Date().toISOString()
        }
      });
    }

    await userService.deleteUser(userId);

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error: any) {
    logger.error('Delete user error:', error);

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
        message: 'Failed to delete user',
        timestamp: new Date().toISOString()
      }
    });
  }
});

export default router;