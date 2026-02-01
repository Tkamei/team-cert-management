import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { UserRole, StudyPlan, Achievement, Certification, Notification } from '../types';
import { studyPlanApi, achievementApi, certificationApi, notificationApi } from '../services/api';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [studyPlans, setStudyPlans] = useState<StudyPlan[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [plansRes, achievementsRes, certificationsRes, notificationsRes] = await Promise.all([
          user?.role === UserRole.ADMIN ? studyPlanApi.getAllPlans() : studyPlanApi.getMyPlans(),
          user?.role === UserRole.ADMIN ? achievementApi.getAllAchievements() : achievementApi.getMyAchievements(),
          certificationApi.getCertifications(),
          notificationApi.getNotifications(),
        ]);

        if (plansRes.data.success) setStudyPlans(plansRes.data.data.plans);
        if (achievementsRes.data.success) setAchievements(achievementsRes.data.data.achievements);
        if (certificationsRes.data.success) setCertifications(certificationsRes.data.data.certifications);
        if (notificationsRes.data.success) setNotifications(notificationsRes.data.data.notifications);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const getStatusText = (status: string) => {
    switch (status) {
      case 'planning': return '計画中';
      case 'in_progress': return '進行中';
      case 'completed': return '完了';
      case 'cancelled': return 'キャンセル';
      default: return status;
    }
  };

  const getCategoryText = (category: string) => {
    switch (category) {
      case 'cloud': return 'クラウド';
      case 'security': return 'セキュリティ';
      case 'programming': return 'プログラミング';
      case 'database': return 'データベース';
      case 'network': return 'ネットワーク';
      case 'project_management': return 'プロジェクト管理';
      default: return category;
    }
  };

  if (isLoading) {
    return <div className="loading">読み込み中...</div>;
  }

  const activePlans = studyPlans.filter(plan => plan.status === 'in_progress');
  const completedPlans = studyPlans.filter(plan => plan.status === 'completed');
  const activeAchievements = achievements.filter(achievement => achievement.isActive);
  const unreadNotifications = notifications.filter(notification => !notification.isRead);

  return (
    <div>
      <h1 style={{ marginBottom: '30px' }}>
        ダッシュボード - {user?.role === UserRole.ADMIN ? '管理者' : 'メンバー'}
      </h1>

      {/* 統計カード */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '30px' }}>
        <div className="card">
          <h3 style={{ color: '#007bff', marginBottom: '10px' }}>総資格数</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>{certifications.length}</p>
        </div>
        
        <div className="card">
          <h3 style={{ color: '#28a745', marginBottom: '10px' }}>進行中の計画</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>{activePlans.length}</p>
        </div>
        
        <div className="card">
          <h3 style={{ color: '#ffc107', marginBottom: '10px' }}>取得済み資格</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>{activeAchievements.length}</p>
        </div>
        
        <div className="card">
          <h3 style={{ color: '#dc3545', marginBottom: '10px' }}>未読通知</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>{unreadNotifications.length}</p>
        </div>
      </div>

      {/* 通知 */}
      {unreadNotifications.length > 0 && (
        <div className="card">
          <h3 style={{ marginBottom: '15px' }}>未読通知</h3>
          {unreadNotifications.slice(0, 5).map(notification => (
            <div key={notification.id} style={{ 
              padding: '10px', 
              backgroundColor: '#f8f9fa', 
              borderRadius: '4px', 
              marginBottom: '10px' 
            }}>
              <h4 style={{ fontSize: '14px', margin: '0 0 5px 0' }}>{notification.title}</h4>
              <p style={{ fontSize: '12px', margin: 0, color: '#6c757d' }}>{notification.message}</p>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
        {/* 進行中の学習計画 */}
        <div className="card">
          <h3 style={{ marginBottom: '15px' }}>進行中の学習計画</h3>
          {activePlans.length === 0 ? (
            <p style={{ color: '#6c757d' }}>進行中の計画はありません</p>
          ) : (
            <div>
              {activePlans.slice(0, 5).map(plan => {
                const certification = certifications.find(c => c.id === plan.certificationId);
                return (
                  <div key={plan.id} style={{ 
                    padding: '10px', 
                    backgroundColor: '#f8f9fa', 
                    borderRadius: '4px', 
                    marginBottom: '10px' 
                  }}>
                    <h4 style={{ fontSize: '14px', margin: '0 0 5px 0' }}>
                      {certification?.name || '不明な資格'}
                    </h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ 
                        flex: 1, 
                        height: '8px', 
                        backgroundColor: '#e9ecef', 
                        borderRadius: '4px',
                        overflow: 'hidden'
                      }}>
                        <div style={{ 
                          width: `${plan.progress}%`, 
                          height: '100%', 
                          backgroundColor: '#28a745',
                          transition: 'width 0.3s ease'
                        }} />
                      </div>
                      <span style={{ fontSize: '12px', color: '#6c757d' }}>
                        {plan.progress}%
                      </span>
                    </div>
                    <p style={{ fontSize: '12px', margin: '5px 0 0 0', color: '#6c757d' }}>
                      目標日: {new Date(plan.targetDate).toLocaleDateString('ja-JP')}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 最近の取得実績 */}
        <div className="card">
          <h3 style={{ marginBottom: '15px' }}>最近の取得実績</h3>
          {activeAchievements.length === 0 ? (
            <p style={{ color: '#6c757d' }}>取得実績はありません</p>
          ) : (
            <div>
              {activeAchievements
                .sort((a, b) => new Date(b.achievedDate).getTime() - new Date(a.achievedDate).getTime())
                .slice(0, 5)
                .map(achievement => {
                  const certification = certifications.find(c => c.id === achievement.certificationId);
                  return (
                    <div key={achievement.id} style={{ 
                      padding: '10px', 
                      backgroundColor: '#f8f9fa', 
                      borderRadius: '4px', 
                      marginBottom: '10px' 
                    }}>
                      <h4 style={{ fontSize: '14px', margin: '0 0 5px 0' }}>
                        {certification?.name || '不明な資格'}
                      </h4>
                      <p style={{ fontSize: '12px', margin: 0, color: '#6c757d' }}>
                        取得日: {new Date(achievement.achievedDate).toLocaleDateString('ja-JP')}
                        {achievement.expiryDate && (
                          <span> | 有効期限: {new Date(achievement.expiryDate).toLocaleDateString('ja-JP')}</span>
                        )}
                      </p>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;