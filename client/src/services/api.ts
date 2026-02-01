import axios, { AxiosResponse } from 'axios';
import { ApiResponse, LoginRequest, AuthResult, User, Certification, StudyPlan, Achievement, Notification } from '../types';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

// レスポンスインターセプター
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // 認証エラーの場合、ログイン画面にリダイレクト
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// 認証API
export const authApi = {
  login: (data: LoginRequest): Promise<AxiosResponse<ApiResponse<AuthResult>>> =>
    api.post('/auth/login', data),
  
  logout: (): Promise<AxiosResponse<ApiResponse<void>>> =>
    api.post('/auth/logout'),
  
  getMe: (): Promise<AxiosResponse<ApiResponse<{ user: User }>>> =>
    api.get('/auth/me'),
  
  validateSession: (): Promise<AxiosResponse<ApiResponse<{ user: User; valid: boolean }>>> =>
    api.get('/auth/validate'),
  
  changePassword: (data: { oldPassword: string; newPassword: string }): Promise<AxiosResponse<ApiResponse<void>>> =>
    api.post('/auth/change-password', data),
};

// ユーザー管理API
export const userApi = {
  getUsers: (): Promise<AxiosResponse<ApiResponse<{ users: User[] }>>> =>
    api.get('/users'),
  
  getUser: (id: string): Promise<AxiosResponse<ApiResponse<{ user: User }>>> =>
    api.get(`/users/${id}`),
  
  createUser: (data: { email: string; name: string; role: string }): Promise<AxiosResponse<ApiResponse<{ user: User }>>> =>
    api.post('/users', data),
  
  updateUser: (id: string, data: Partial<User>): Promise<AxiosResponse<ApiResponse<{ user: User }>>> =>
    api.put(`/users/${id}`, data),
  
  deleteUser: (id: string): Promise<AxiosResponse<ApiResponse<void>>> =>
    api.delete(`/users/${id}`),
};

// 資格管理API
export const certificationApi = {
  getCertifications: (): Promise<AxiosResponse<ApiResponse<{ certifications: Certification[] }>>> =>
    api.get('/certifications'),
  
  getCertification: (id: string): Promise<AxiosResponse<ApiResponse<{ certification: Certification }>>> =>
    api.get(`/certifications/${id}`),
  
  searchCertifications: (query: string): Promise<AxiosResponse<ApiResponse<{ certifications: Certification[] }>>> =>
    api.get(`/certifications/search?q=${encodeURIComponent(query)}`),
  
  createCertification: (data: Partial<Certification>): Promise<AxiosResponse<ApiResponse<{ certification: Certification }>>> =>
    api.post('/certifications', data),
  
  updateCertification: (id: string, data: Partial<Certification>): Promise<AxiosResponse<ApiResponse<{ certification: Certification }>>> =>
    api.put(`/certifications/${id}`, data),
  
  deleteCertification: (id: string): Promise<AxiosResponse<ApiResponse<void>>> =>
    api.delete(`/certifications/${id}`),
};

// 学習計画API
export const studyPlanApi = {
  getMyPlans: (): Promise<AxiosResponse<ApiResponse<{ plans: StudyPlan[] }>>> =>
    api.get('/study-plans/my'),
  
  getAllPlans: (): Promise<AxiosResponse<ApiResponse<{ plans: StudyPlan[] }>>> =>
    api.get('/study-plans'),
  
  getPlan: (id: string): Promise<AxiosResponse<ApiResponse<{ plan: StudyPlan }>>> =>
    api.get(`/study-plans/${id}`),
  
  createPlan: (data: { certificationId: string; targetDate: string; startDate: string }): Promise<AxiosResponse<ApiResponse<{ plan: StudyPlan }>>> =>
    api.post('/study-plans', data),
  
  updatePlan: (id: string, data: Partial<StudyPlan>): Promise<AxiosResponse<ApiResponse<{ plan: StudyPlan }>>> =>
    api.put(`/study-plans/${id}`, data),
  
  updateProgress: (id: string, progress: number): Promise<AxiosResponse<ApiResponse<{ plan: StudyPlan }>>> =>
    api.patch(`/study-plans/${id}/progress`, { progress }),
  
  deletePlan: (id: string): Promise<AxiosResponse<ApiResponse<void>>> =>
    api.delete(`/study-plans/${id}`),
};

// 取得履歴API
export const achievementApi = {
  getMyAchievements: (): Promise<AxiosResponse<ApiResponse<{ achievements: Achievement[] }>>> =>
    api.get('/achievements/my'),
  
  getAllAchievements: (): Promise<AxiosResponse<ApiResponse<{ achievements: Achievement[] }>>> =>
    api.get('/achievements'),
  
  createAchievement: (data: { certificationId: string; achievedDate: string; certificationNumber?: string; expiryDate?: string }): Promise<AxiosResponse<ApiResponse<{ achievement: Achievement }>>> =>
    api.post('/achievements', data),
  
  updateAchievement: (id: string, data: Partial<Achievement>): Promise<AxiosResponse<ApiResponse<{ achievement: Achievement }>>> =>
    api.put(`/achievements/${id}`, data),
  
  deleteAchievement: (id: string): Promise<AxiosResponse<ApiResponse<void>>> =>
    api.delete(`/achievements/${id}`),
};

// 通知API
export const notificationApi = {
  getNotifications: (): Promise<AxiosResponse<ApiResponse<{ notifications: Notification[] }>>> =>
    api.get('/notifications'),
  
  markAsRead: (id: string): Promise<AxiosResponse<ApiResponse<void>>> =>
    api.patch(`/notifications/${id}/read`),
  
  markAllAsRead: (): Promise<AxiosResponse<ApiResponse<void>>> =>
    api.patch('/notifications/read-all'),
  
  deleteNotification: (id: string): Promise<AxiosResponse<ApiResponse<void>>> =>
    api.delete(`/notifications/${id}`),
};

export default api;