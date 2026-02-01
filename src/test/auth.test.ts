import { SimpleAuthenticationService, SimpleAuthorizationService, UserManagementService } from '../services/auth';
import { JSONStorage } from '../data/storage';
import { UserRole } from '../types';
import * as bcrypt from 'bcryptjs';

describe('Authentication Services', () => {
  const testDataDir = './test-data-auth';
  let storage: JSONStorage;
  let authService: SimpleAuthenticationService;
  let authzService: SimpleAuthorizationService;
  let userService: UserManagementService;

  beforeEach(async () => {
    storage = new JSONStorage(testDataDir);
    await storage.initializeDataDirectory();
    
    authService = new SimpleAuthenticationService(storage);
    authzService = new SimpleAuthorizationService(storage);
    userService = new UserManagementService(storage);
  });

  describe('UserManagementService', () => {
    it('should create a new user with hashed password', async () => {
      const userData = {
        email: 'test@example.com',
        name: 'Test User',
        role: UserRole.MEMBER
      };

      const user = await userService.createUser(userData);

      expect(user.email).toBe(userData.email);
      expect(user.name).toBe(userData.name);
      expect(user.role).toBe(userData.role);
      expect(user.requiresPasswordChange).toBe(true);
      expect(user.id).toBeDefined();
      expect(user.createdAt).toBeDefined();

      // パスワードハッシュが保存されていることを確認
      const usersData = await storage.readUsers();
      const savedUser = usersData.users.find(u => u.id === user.id);
      expect(savedUser?.passwordHash).toBeDefined();
      expect(savedUser?.passwordHash).not.toBe(''); // 空でない
    });

    it('should not allow duplicate email addresses', async () => {
      const userData = {
        email: 'duplicate@example.com',
        name: 'User 1',
        role: UserRole.MEMBER
      };

      await userService.createUser(userData);

      const duplicateUserData = {
        email: 'duplicate@example.com',
        name: 'User 2',
        role: UserRole.ADMIN
      };

      await expect(userService.createUser(duplicateUserData)).rejects.toThrow('Email already exists');
    });

    it('should update user information', async () => {
      const userData = {
        email: 'update@example.com',
        name: 'Original Name',
        role: UserRole.MEMBER
      };

      const user = await userService.createUser(userData);

      const updateData = {
        name: 'Updated Name',
        role: UserRole.ADMIN
      };

      const updatedUser = await userService.updateUser(user.id, updateData);

      expect(updatedUser.name).toBe(updateData.name);
      expect(updatedUser.role).toBe(updateData.role);
      expect(updatedUser.email).toBe(userData.email); // 変更されていない
    });

    it('should delete user and related sessions', async () => {
      const userData = {
        email: 'delete@example.com',
        name: 'Delete User',
        role: UserRole.MEMBER
      };

      const user = await userService.createUser(userData);

      // ユーザーが存在することを確認
      const foundUser = await userService.getUser(user.id);
      expect(foundUser).not.toBeNull();

      // ユーザーを削除
      await userService.deleteUser(user.id);

      // ユーザーが削除されたことを確認
      const deletedUser = await userService.getUser(user.id);
      expect(deletedUser).toBeNull();
    });
  });

  describe('SimpleAuthenticationService', () => {
    let testUser: any;
    const testPassword = 'testpassword123';

    beforeEach(async () => {
      // テスト用ユーザーを作成
      const usersData = await storage.readUsers();
      const passwordHash = await bcrypt.hash(testPassword, 10);
      
      testUser = {
        id: 'test-user-id',
        email: 'auth@example.com',
        name: 'Auth Test User',
        role: UserRole.MEMBER,
        passwordHash,
        requiresPasswordChange: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      usersData.users.push(testUser);
      await storage.writeUsers(usersData);
    });

    it('should login with valid credentials', async () => {
      const loginData = {
        email: testUser.email,
        password: testPassword
      };

      const result = await authService.login(loginData);

      expect(result.sessionId).toBeDefined();
      expect(result.user.email).toBe(testUser.email);
      expect(result.user.id).toBe(testUser.id);
      expect(result.requiresPasswordChange).toBe(false);

      // セッションが保存されていることを確認
      const sessionsData = await storage.readSessions();
      const session = sessionsData.sessions.find(s => s.sessionId === result.sessionId);
      expect(session).toBeDefined();
      expect(session?.userId).toBe(testUser.id);
      expect(session?.isActive).toBe(true);
    });

    it('should reject invalid credentials', async () => {
      const loginData = {
        email: testUser.email,
        password: 'wrongpassword'
      };

      await expect(authService.login(loginData)).rejects.toThrow('Invalid credentials');
    });

    it('should reject non-existent user', async () => {
      const loginData = {
        email: 'nonexistent@example.com',
        password: testPassword
      };

      await expect(authService.login(loginData)).rejects.toThrow('Invalid credentials');
    });

    it('should validate active session', async () => {
      const loginResult = await authService.login({
        email: testUser.email,
        password: testPassword
      });

      const user = await authService.validateSession(loginResult.sessionId);

      expect(user).not.toBeNull();
      expect(user?.id).toBe(testUser.id);
      expect(user?.email).toBe(testUser.email);
    });

    it('should reject invalid session', async () => {
      const user = await authService.validateSession('invalid-session-id');
      expect(user).toBeNull();
    });

    it('should logout and deactivate session', async () => {
      const loginResult = await authService.login({
        email: testUser.email,
        password: testPassword
      });

      await authService.logout(loginResult.sessionId);

      // セッションが無効化されていることを確認
      const user = await authService.validateSession(loginResult.sessionId);
      expect(user).toBeNull();
    });

    it('should change password successfully', async () => {
      const changePasswordData = {
        oldPassword: testPassword,
        newPassword: 'newpassword123'
      };

      await authService.changePassword(testUser.id, changePasswordData);

      // 新しいパスワードでログインできることを確認
      const loginResult = await authService.login({
        email: testUser.email,
        password: changePasswordData.newPassword
      });

      expect(loginResult.sessionId).toBeDefined();

      // 古いパスワードではログインできないことを確認
      await expect(authService.login({
        email: testUser.email,
        password: testPassword
      })).rejects.toThrow('Invalid credentials');
    });

    it('should reject password change with wrong old password', async () => {
      const changePasswordData = {
        oldPassword: 'wrongoldpassword',
        newPassword: 'newpassword123'
      };

      await expect(authService.changePassword(testUser.id, changePasswordData))
        .rejects.toThrow('Current password is incorrect');
    });
  });

  describe('SimpleAuthorizationService', () => {
    let adminUser: any;
    let memberUser: any;
    let adminSessionId: string;
    let memberSessionId: string;

    beforeEach(async () => {
      // テスト用ユーザーを作成
      const usersData = await storage.readUsers();
      const passwordHash = await bcrypt.hash('testpass', 10);

      adminUser = {
        id: 'admin-user-id',
        email: 'admin@example.com',
        name: 'Admin User',
        role: UserRole.ADMIN,
        passwordHash,
        requiresPasswordChange: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      memberUser = {
        id: 'member-user-id',
        email: 'member@example.com',
        name: 'Member User',
        role: UserRole.MEMBER,
        passwordHash,
        requiresPasswordChange: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      usersData.users.push(adminUser, memberUser);
      await storage.writeUsers(usersData);

      // セッションを作成
      const adminLoginResult = await authService.login({
        email: adminUser.email,
        password: 'testpass'
      });
      adminSessionId = adminLoginResult.sessionId;

      const memberLoginResult = await authService.login({
        email: memberUser.email,
        password: 'testpass'
      });
      memberSessionId = memberLoginResult.sessionId;
    });

    it('should grant admin full permissions', async () => {
      const hasPermission = await authzService.hasPermission(adminSessionId, 'users', 'create');
      expect(hasPermission).toBe(true);

      const hasDeletePermission = await authzService.hasPermission(adminSessionId, 'certifications', 'delete');
      expect(hasDeletePermission).toBe(true);
    });

    it('should restrict member permissions', async () => {
      const hasCreatePermission = await authzService.hasPermission(memberSessionId, 'users', 'create');
      expect(hasCreatePermission).toBe(false);

      const hasReadPermission = await authzService.hasPermission(memberSessionId, 'certifications', 'read');
      expect(hasReadPermission).toBe(true);
    });

    it('should get correct user roles', async () => {
      const adminRole = await authzService.getUserRole(adminSessionId);
      expect(adminRole).toBe(UserRole.ADMIN);

      const memberRole = await authzService.getUserRole(memberSessionId);
      expect(memberRole).toBe(UserRole.MEMBER);
    });

    it('should reject invalid session for permissions', async () => {
      const hasPermission = await authzService.hasPermission('invalid-session', 'users', 'read');
      expect(hasPermission).toBe(false);
    });
  });
});