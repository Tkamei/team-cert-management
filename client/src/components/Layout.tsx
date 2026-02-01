import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { UserRole } from '../types';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (!user) {
    return <div className="loading">読み込み中...</div>;
  }

  return (
    <div>
      <nav className="navbar">
        <div className="container" style={{ display: 'flex', alignItems: 'center' }}>
          <div className="navbar-brand">チーム資格管理システム</div>
          <ul className="navbar-nav">
            <li><a href="/dashboard" className="nav-link">ダッシュボード</a></li>
            {user.role === UserRole.ADMIN && (
              <>
                <li><a href="/certifications" className="nav-link">資格管理</a></li>
                <li><a href="/users" className="nav-link">ユーザー管理</a></li>
              </>
            )}
            <li><a href="/study-plans" className="nav-link">学習計画</a></li>
            <li><a href="/achievements" className="nav-link">取得履歴</a></li>
            <li>
              <span className="nav-link" style={{ cursor: 'default' }}>
                {user.name} ({user.role === UserRole.ADMIN ? '管理者' : 'メンバー'})
              </span>
            </li>
            <li>
              <button onClick={handleLogout} className="nav-link" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                ログアウト
              </button>
            </li>
          </ul>
        </div>
      </nav>
      <div className="container">
        {children}
      </div>
    </div>
  );
};

export default Layout;