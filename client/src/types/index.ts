// API レスポンス型
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
    details?: Array<{
      field: string;
      message: string;
    }>;
    timestamp: string;
  };
}

// ユーザー関連型
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  requiresPasswordChange: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

export enum UserRole {
  ADMIN = "admin",
  MEMBER = "member"
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResult {
  sessionId: string;
  user: Omit<User, 'passwordHash'>;
  requiresPasswordChange: boolean;
}

// 資格関連型
export interface Certification {
  id: string;
  name: string;
  issuer: string;
  category: CertificationCategory;
  difficulty: number;
  description: string;
  validityPeriod?: number;
  createdAt: string;
  updatedAt: string;
}

export enum CertificationCategory {
  CLOUD = "cloud",
  SECURITY = "security",
  PROGRAMMING = "programming",
  DATABASE = "database",
  NETWORK = "network",
  PROJECT_MANAGEMENT = "project_management"
}

// 学習計画関連型
export interface StudyPlan {
  id: string;
  userId: string;
  certificationId: string;
  targetDate: string;
  startDate: string;
  progress: number;
  status: PlanStatus;
  createdAt: string;
  updatedAt: string;
}

export enum PlanStatus {
  PLANNING = "planning",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
  CANCELLED = "cancelled"
}

// 取得履歴関連型
export interface Achievement {
  id: string;
  userId: string;
  certificationId: string;
  achievedDate: string;
  certificationNumber?: string;
  expiryDate?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// 通知関連型
export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: any;
  isRead: boolean;
  createdAt: string;
}

export enum NotificationType {
  PLAN_REMINDER = "plan_reminder",
  EXPIRY_WARNING = "expiry_warning",
  NEW_CERTIFICATION = "new_certification",
  ACHIEVEMENT_REPORT = "achievement_report"
}

// ダッシュボード関連型
export interface DashboardData {
  totalCertifications: number;
  activePlans: number;
  completedThisMonth: number;
  expiringCertifications: number;
  categoryBreakdown: CategoryStats[];
  recentAchievements: Achievement[];
}

export interface CategoryStats {
  category: CertificationCategory;
  count: number;
  percentage: number;
}