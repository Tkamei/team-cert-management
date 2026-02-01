import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { JSONStorage } from '../data/storage';
import { 
  User, 
  UserRole, 
  Session, 
  LoginRequest, 
  ChangePasswordRequest, 
  AuthResult,
  CreateUserRequest,
  UpdateUserRequest
} from '../types';
import { logger, logUserAction } from '../utils/logger';

export class SimpleAuthenticationService {
  constructor(private storage: JSONStorage) {}

  /**
   * ユーザーログイン
   */
  async login(loginData: LoginRequest): Promise<AuthResult> {
    try {
      const usersData = await this.storage.readUsers();
      const user = usersData.users.find(u => u.email === loginData.email);

      if (!user) {
        throw new Error('Invalid credentials');
      }

      const isPasswordValid = await bcrypt.compare(loginData.password, user.passwordHash);
      if (!isPasswordValid) {
        throw new Error('Invalid credentials');
      }

      // セッションを作成
      const sessionId = uuidv4();
      const session: Session = {
        sessionId,
        userId: user.id,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24時間
        isActive: true
      };

      // セッションを保存
      const sessionsData = await this.storage.readSessions();
      sessionsData.sessions.push(session);
      await this.storage.writeSessions(sessionsData);

      // 最終ログイン時刻を更新
      user.lastLoginAt = new Date().toISOString();
      user.updatedAt = new Date().toISOString();
      await this.storage.writeUsers(usersData);

      logUserAction(user.id, 'login', 'auth', { email: user.email });

      return {
        sessionId,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          requiresPasswordChange: user.requiresPasswordChange,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          ...(user.lastLoginAt && { lastLoginAt: user.lastLoginAt })
        },
        requiresPasswordChange: user.requiresPasswordChange
      };
    } catch (error) {
      logger.error('Login failed:', error);
      throw error;
    }
  }

  /**
   * ユーザーログアウト
   */
  async logout(sessionId: string): Promise<void> {
    try {
      const sessionsData = await this.storage.readSessions();
      const sessionIndex = sessionsData.sessions.findIndex(s => s.sessionId === sessionId);

      if (sessionIndex !== -1) {
        const session = sessionsData.sessions[sessionIndex];
        if (session) {
          session.isActive = false;
          await this.storage.writeSessions(sessionsData);

          logUserAction(session.userId, 'logout', 'auth', { sessionId });
        }
      }
    } catch (error) {
      logger.error('Logout failed:', error);
      throw error;
    }
  }

  /**
   * セッション検証
   */
  async validateSession(sessionId: string): Promise<Omit<User, 'passwordHash'> | null> {
    try {
      const sessionsData = await this.storage.readSessions();
      const session = sessionsData.sessions.find(s => 
        s.sessionId === sessionId && 
        s.isActive && 
        new Date(s.expiresAt) > new Date()
      );

      if (!session) {
        return null;
      }

      const usersData = await this.storage.readUsers();
      const user = usersData.users.find(u => u.id === session.userId);

      if (!user) {
        return null;
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        requiresPasswordChange: user.requiresPasswordChange,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        ...(user.lastLoginAt && { lastLoginAt: user.lastLoginAt })
      };
    } catch (error) {
      logger.error('Session validation failed:', error);
      return null;
    }
  }

  /**
   * パスワード変更
   */
  async changePassword(userId: string, changePasswordData: ChangePasswordRequest): Promise<void> {
    try {
      const usersData = await this.storage.readUsers();
      const user = usersData.users.find(u => u.id === userId);

      if (!user) {
        throw new Error('User not found');
      }

      // 現在のパスワードを検証
      const isCurrentPasswordValid = await bcrypt.compare(changePasswordData.oldPassword, user.passwordHash);
      if (!isCurrentPasswordValid) {
        throw new Error('Current password is incorrect');
      }

      // 新しいパスワードをハッシュ化
      const newPasswordHash = await bcrypt.hash(changePasswordData.newPassword, 10);
      
      // ユーザー情報を更新
      user.passwordHash = newPasswordHash;
      user.requiresPasswordChange = false;
      user.updatedAt = new Date().toISOString();

      await this.storage.writeUsers(usersData);

      logUserAction(userId, 'change_password', 'auth');
    } catch (error) {
      logger.error('Password change failed:', error);
      throw error;
    }
  }

  /**
   * セッションクリーンアップ（期限切れセッションを削除）
   */
  async cleanupExpiredSessions(): Promise<void> {
    try {
      const sessionsData = await this.storage.readSessions();
      const now = new Date();
      
      const activeSessions = sessionsData.sessions.filter(session => 
        session.isActive && new Date(session.expiresAt) > now
      );

      if (activeSessions.length !== sessionsData.sessions.length) {
        sessionsData.sessions = activeSessions;
        await this.storage.writeSessions(sessionsData);
        logger.info('Expired sessions cleaned up');
      }
    } catch (error) {
      logger.error('Session cleanup failed:', error);
    }
  }
}

export class SimpleAuthorizationService {
  constructor(private storage: JSONStorage) {}

  /**
   * 権限チェック
   */
  async hasPermission(sessionId: string, resource: string, action: string): Promise<boolean> {
    try {
      const authService = new SimpleAuthenticationService(this.storage);
      const user = await authService.validateSession(sessionId);

      if (!user) {
        return false;
      }

      // 管理者は全ての操作が可能
      if (user.role === UserRole.ADMIN) {
        return true;
      }

      // メンバーの権限チェック
      return this.checkMemberPermission(user, resource, action);
    } catch (error) {
      logger.error('Permission check failed:', error);
      return false;
    }
  }

  /**
   * ユーザーロールを取得
   */
  async getUserRole(sessionId: string): Promise<UserRole | null> {
    try {
      const authService = new SimpleAuthenticationService(this.storage);
      const user = await authService.validateSession(sessionId);
      return user ? user.role : null;
    } catch (error) {
      logger.error('Get user role failed:', error);
      return null;
    }
  }

  /**
   * メンバーの権限チェック
   */
  private checkMemberPermission(user: Omit<User, 'passwordHash'>, resource: string, action: string): boolean {
    // メンバーは自分のデータのみ操作可能
    switch (resource) {
      case 'users':
        return action === 'read' || action === 'update_self';
      case 'certifications':
        return action === 'read';
      case 'study_plans':
        return true; // 自分の学習計画は全操作可能
      case 'achievements':
        return true; // 自分の取得履歴は全操作可能
      case 'notifications':
        return action === 'read' || action === 'update';
      default:
        return false;
    }
  }
}

export class UserManagementService {
  constructor(private storage: JSONStorage) {}

  /**
   * ユーザー作成（管理者のみ）
   */
  async createUser(userData: CreateUserRequest): Promise<Omit<User, 'passwordHash'>> {
    try {
      const usersData = await this.storage.readUsers();
      
      // メールアドレスの重複チェック
      const existingUser = usersData.users.find(u => u.email === userData.email);
      if (existingUser) {
        throw new Error('Email already exists');
      }

      // 初期パスワードを生成
      const initialPassword = this.generateInitialPassword();
      const passwordHash = await bcrypt.hash(initialPassword, 10);

      const newUser: User = {
        id: uuidv4(),
        email: userData.email,
        name: userData.name,
        role: userData.role,
        passwordHash,
        requiresPasswordChange: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      usersData.users.push(newUser);
      await this.storage.writeUsers(usersData);

      logger.info('User created', { userId: newUser.id, email: newUser.email, role: newUser.role });

      // パスワードハッシュを除いて返す
      return {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        requiresPasswordChange: newUser.requiresPasswordChange,
        createdAt: newUser.createdAt,
        updatedAt: newUser.updatedAt,
        ...(newUser.lastLoginAt && { lastLoginAt: newUser.lastLoginAt })
      };
    } catch (error) {
      logger.error('User creation failed:', error);
      throw error;
    }
  }

  /**
   * ユーザー更新
   */
  async updateUser(userId: string, userData: UpdateUserRequest): Promise<Omit<User, 'passwordHash'>> {
    try {
      const usersData = await this.storage.readUsers();
      const userIndex = usersData.users.findIndex(u => u.id === userId);

      if (userIndex === -1) {
        throw new Error('User not found');
      }

      const user = usersData.users[userIndex];
      if (!user) {
        throw new Error('User not found');
      }

      // メールアドレスの重複チェック（変更する場合）
      if (userData.email && userData.email !== user.email) {
        const existingUser = usersData.users.find(u => u.email === userData.email && u.id !== userId);
        if (existingUser) {
          throw new Error('Email already exists');
        }
      }

      // ユーザー情報を更新
      if (userData.email) user.email = userData.email;
      if (userData.name) user.name = userData.name;
      if (userData.role) user.role = userData.role;
      user.updatedAt = new Date().toISOString();

      await this.storage.writeUsers(usersData);

      logUserAction(userId, 'update_user', 'users', userData);

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        requiresPasswordChange: user.requiresPasswordChange,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        ...(user.lastLoginAt && { lastLoginAt: user.lastLoginAt })
      };
    } catch (error) {
      logger.error('User update failed:', error);
      throw error;
    }
  }

  /**
   * ユーザー削除
   */
  async deleteUser(userId: string): Promise<void> {
    try {
      const usersData = await this.storage.readUsers();
      const userIndex = usersData.users.findIndex(u => u.id === userId);

      if (userIndex === -1) {
        throw new Error('User not found');
      }

      const user = usersData.users[userIndex];
      if (!user) {
        throw new Error('User not found');
      }
      
      usersData.users.splice(userIndex, 1);
      await this.storage.writeUsers(usersData);

      // 関連するセッションも削除
      const sessionsData = await this.storage.readSessions();
      sessionsData.sessions = sessionsData.sessions.filter(s => s.userId !== userId);
      await this.storage.writeSessions(sessionsData);

      logUserAction(userId, 'delete_user', 'users', { email: user.email });
    } catch (error) {
      logger.error('User deletion failed:', error);
      throw error;
    }
  }

  /**
   * ユーザー取得
   */
  async getUser(userId: string): Promise<Omit<User, 'passwordHash'> | null> {
    try {
      const usersData = await this.storage.readUsers();
      const user = usersData.users.find(u => u.id === userId);

      if (!user) {
        return null;
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        requiresPasswordChange: user.requiresPasswordChange,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        ...(user.lastLoginAt && { lastLoginAt: user.lastLoginAt })
      };
    } catch (error) {
      logger.error('Get user failed:', error);
      return null;
    }
  }

  /**
   * ユーザー一覧取得
   */
  async listUsers(): Promise<Omit<User, 'passwordHash'>[]> {
    try {
      const usersData = await this.storage.readUsers();
      
      return usersData.users.map(user => ({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        requiresPasswordChange: user.requiresPasswordChange,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        ...(user.lastLoginAt && { lastLoginAt: user.lastLoginAt })
      }));
    } catch (error) {
      logger.error('List users failed:', error);
      throw error;
    }
  }

  /**
   * 初期パスワード生成
   */
  private generateInitialPassword(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }
}