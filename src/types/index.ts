// 型定義
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  passwordHash: string;
  requiresPasswordChange: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

export interface Certification {
  id: string;
  name: string;
  issuer: string;
  category: CertificationCategory;
  difficulty: number; // 1-5
  description: string;
  validityPeriod?: number; // months
  createdAt: string;
  updatedAt: string;
}

export interface StudyPlan {
  id: string;
  userId: string;
  certificationId: string;
  targetDate: string;
  startDate: string;
  progress: number; // 0-100
  status: PlanStatus;
  createdAt: string;
  updatedAt: string;
}

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

export interface Session {
  sessionId: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
  isActive: boolean;
}

// 列挙型
export enum UserRole {
  ADMIN = "admin",
  MEMBER = "member"
}

export enum CertificationCategory {
  CLOUD = "cloud",
  SECURITY = "security", 
  PROGRAMMING = "programming",
  DATABASE = "database",
  NETWORK = "network",
  PROJECT_MANAGEMENT = "project_management"
}

export enum PlanStatus {
  PLANNING = "planning",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
  CANCELLED = "cancelled"
}

export enum NotificationType {
  PLAN_REMINDER = "plan_reminder",
  EXPIRY_WARNING = "expiry_warning",
  NEW_CERTIFICATION = "new_certification",
  ACHIEVEMENT_REPORT = "achievement_report"
}

// リクエスト/レスポンス型
export interface CreateUserRequest {
  email: string;
  name: string;
  role: UserRole;
}

export interface UpdateUserRequest {
  email?: string;
  name?: string;
  role?: UserRole;
}

export interface CreateCertificationRequest {
  name: string;
  issuer: string;
  category: CertificationCategory;
  difficulty: number;
  description: string;
  validityPeriod?: number;
}

export interface UpdateCertificationRequest {
  name?: string;
  issuer?: string;
  category?: CertificationCategory;
  difficulty?: number;
  description?: string;
  validityPeriod?: number;
}

export interface CreatePlanRequest {
  certificationId: string;
  targetDate: string;
  startDate: string;
}

export interface UpdatePlanRequest {
  targetDate?: string;
  startDate?: string;
  progress?: number;
  status?: PlanStatus;
}

export interface CreateAchievementRequest {
  certificationId: string;
  achievedDate: string;
  certificationNumber?: string;
  expiryDate?: string;
}

export interface UpdateAchievementRequest {
  achievedDate?: string;
  certificationNumber?: string;
  expiryDate?: string;
  isActive?: boolean;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
}

export interface AuthResult {
  sessionId: string;
  user: Omit<User, 'passwordHash'>;
  requiresPasswordChange: boolean;
}

// フィルター型
export interface CertificationFilters {
  category?: CertificationCategory;
  issuer?: string;
  difficulty?: number;
}

// レポート型
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

export interface PeriodReport {
  period: {
    startDate: string;
    endDate: string;
  };
  achievements: Achievement[];
  completedPlans: StudyPlan[];
  planCompletionRate: number;
  popularCertifications: Array<{
    certification: Certification;
    achievementCount: number;
  }>;
}

export interface UserReport {
  user: Omit<User, 'passwordHash'>;
  achievements: Achievement[];
  activePlans: StudyPlan[];
  completedPlans: StudyPlan[];
  recommendedCertifications: Certification[];
}

// JSONファイル構造型
export interface UsersData {
  users: User[];
}

export interface CertificationsData {
  certifications: Certification[];
}

export interface StudyPlansData {
  studyPlans: StudyPlan[];
}

export interface AchievementsData {
  achievements: Achievement[];
}

export interface NotificationsData {
  notifications: Notification[];
}

export interface SessionsData {
  sessions: Session[];
}

// エラー型
export interface ApiError {
  code: string;
  message: string;
  details?: Array<{
    field: string;
    message: string;
  }>;
  timestamp: string;
  requestId?: string;
}