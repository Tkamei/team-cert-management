console.log('app.js loaded');

// グローバル状態
let currentUser = null;
let sessionId = null;
let currentPage = 'dashboard';

// API呼び出しヘルパー
async function apiCall(url, options = {}) {
    try {
        const response = await fetch(url, {
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                ...(sessionId && { 'Authorization': `Bearer ${sessionId}` }),
                ...options.headers
            },
            ...options
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error?.message || 'Unknown error');
        }
        
        return data;
    } catch (error) {
        throw error;
    }
}

// ページ読み込み
async function loadPage(page) {
    currentPage = page;
    
    // アクティブなナビゲーションリンクを更新
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    document.querySelector(`.nav-link[data-page="${page}"]`)?.classList.add('active');
    
    const contentDiv = document.getElementById('pageContent');
    contentDiv.innerHTML = '<div class="loading">読み込み中...</div>';
    
    try {
        switch (page) {
            case 'dashboard':
                await loadDashboard();
                break;
            case 'certifications':
                await loadCertifications();
                break;
            case 'study-plans':
                await loadStudyPlans();
                break;
            case 'achievements':
                await loadAchievements();
                break;
            case 'users':
                await loadUsers();
                break;
            default:
                contentDiv.innerHTML = '<div class="card"><h2>ページが見つかりません</h2></div>';
        }
    } catch (error) {
        contentDiv.innerHTML = `<div class="error">エラーが発生しました: ${error.message}</div>`;
    }
}

// ダッシュボード
async function loadDashboard() {
    try {
        // 各種データを並行取得
        const [certsRes, plansRes, achievementsRes, notificationsRes] = await Promise.all([
            apiCall('/api/certifications'),
            currentUser.role === 'admin' ? apiCall('/api/study-plans') : apiCall('/api/study-plans/my'),
            currentUser.role === 'admin' ? apiCall('/api/achievements') : apiCall('/api/achievements/my'),
            apiCall('/api/notifications/my').catch(() => ({ data: { notifications: [] } })) // 通知APIがない場合のフォールバック
        ]);

        const certifications = certsRes.data.certifications || [];
        const plans = plansRes.data.plans || [];
        const achievements = achievementsRes.data.achievements || [];
        const notifications = notificationsRes.data.notifications || [];

        // 統計計算
        const totalCertifications = certifications.length;
        const activePlans = plans.filter(plan => plan.status === 'in_progress' || plan.status === 'planning').length;
        const activeAchievements = achievements.filter(achievement => achievement.isActive).length;
        const unreadNotifications = notifications.filter(notification => !notification.isRead).length;

        // 進行中の学習計画（最新3件）
        const inProgressPlans = plans
            .filter(plan => plan.status === 'in_progress' || plan.status === 'planning')
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
            .slice(0, 3);

        // 最近の取得実績（最新3件）
        const recentAchievements = achievements
            .filter(achievement => achievement.isActive)
            .sort((a, b) => new Date(b.achievedDate).getTime() - new Date(a.achievedDate).getTime())
            .slice(0, 3);

        const html = `
            <div style="height: calc(100vh - 80px); padding: 24px; display: flex; flex-direction: column; max-width: 1600px; margin: 0 auto;">
                <div style="margin-bottom: 24px;">
                    <h1 style="font-size: 2rem; font-weight: 700; color: #1a1a1a; margin-bottom: 4px;">ダッシュボード</h1>
                    <p style="font-size: 0.95rem; color: #6b7280;">ようこそ、${currentUser.name}さん</p>
                </div>
                
                <!-- Bento Grid Layout -->
                <div style="flex: 1; display: grid; grid-template-columns: repeat(4, 1fr); grid-template-rows: repeat(2, 1fr); gap: 20px; min-height: 0;">
                    <!-- 統計カード -->
                    <div class="stat-card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 24px;">
                        <div class="stat-label" style="color: rgba(255,255,255,0.9); font-size: 0.85rem; font-weight: 500;">総資格数</div>
                        <div class="stat-value" style="font-size: 2.5rem; font-weight: 800; margin: 12px 0;">${totalCertifications}</div>
                        <div style="font-size: 0.8rem; opacity: 0.9;">登録済み</div>
                    </div>
                    
                    <div class="stat-card" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 24px;">
                        <div class="stat-label" style="color: rgba(255,255,255,0.9); font-size: 0.85rem; font-weight: 500;">進行中の計画</div>
                        <div class="stat-value" style="font-size: 2.5rem; font-weight: 800; margin: 12px 0;">${activePlans}</div>
                        <div style="font-size: 0.8rem; opacity: 0.9;">アクティブ</div>
                    </div>
                    
                    <div class="stat-card" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; padding: 24px;">
                        <div class="stat-label" style="color: rgba(255,255,255,0.9); font-size: 0.85rem; font-weight: 500;">取得済み資格</div>
                        <div class="stat-value" style="font-size: 2.5rem; font-weight: 800; margin: 12px 0;">${activeAchievements}</div>
                        <div style="font-size: 0.8rem; opacity: 0.9;">有効</div>
                    </div>
                    
                    <div class="stat-card" style="background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%); color: white; padding: 24px;">
                        <div class="stat-label" style="color: rgba(255,255,255,0.9); font-size: 0.85rem; font-weight: 500;">未読通知</div>
                        <div class="stat-value" style="font-size: 2.5rem; font-weight: 800; margin: 12px 0;">${unreadNotifications}</div>
                        <div style="font-size: 0.8rem; opacity: 0.9;">新着</div>
                    </div>
                    
                    <!-- メインコンテンツ -->
                    <div class="card" style="grid-column: span 2; padding: 24px; display: flex; flex-direction: column;">
                        <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 16px; color: #1a1a1a;">進行中の学習計画</h3>
                        <div style="flex: 1; overflow: auto;">
                            ${inProgressPlans.length === 0 ? `
                                <div style="display: flex; align-items: center; justify-content: center; height: 100%;">
                                    <p style="color: #9ca3af;">学習計画がありません</p>
                                </div>
                            ` : `
                                <div style="display: flex; flex-direction: column; gap: 12px;">
                                    ${inProgressPlans.map(plan => {
                                        const cert = certifications.find(c => c.id === plan.certificationId);
                                        const statusMap = {
                                            planning: '計画中',
                                            in_progress: '進行中',
                                            completed: '完了',
                                            cancelled: 'キャンセル'
                                        };
                                        return `
                                            <div style="padding: 12px; border: 1px solid #e5e7eb; border-radius: 8px; background: #f9fafb;">
                                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                                    <h4 style="font-size: 0.9rem; font-weight: 600; color: #1a1a1a; margin: 0;">${cert?.name || '不明な資格'}</h4>
                                                    <span style="font-size: 0.75rem; color: #6b7280;">${statusMap[plan.status]}</span>
                                                </div>
                                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                                    <div style="flex: 1; margin-right: 12px;">
                                                        <div style="height: 6px; background: #e5e7eb; border-radius: 3px; overflow: hidden;">
                                                            <div style="height: 100%; background: linear-gradient(90deg, #667eea 0%, #764ba2 100%); width: ${plan.progress}%;"></div>
                                                        </div>
                                                    </div>
                                                    <span style="font-size: 0.75rem; font-weight: 600; color: #1a1a1a;">${plan.progress}%</span>
                                                </div>
                                            </div>
                                        `;
                                    }).join('')}
                                </div>
                            `}
                        </div>
                    </div>
                    
                    <div class="card" style="grid-column: span 2; padding: 24px; display: flex; flex-direction: column;">
                        <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 16px; color: #1a1a1a;">最近の取得実績</h3>
                        <div style="flex: 1; overflow: auto;">
                            ${recentAchievements.length === 0 ? `
                                <div style="display: flex; align-items: center; justify-content: center; height: 100%;">
                                    <p style="color: #9ca3af;">取得実績がありません</p>
                                </div>
                            ` : `
                                <div style="display: flex; flex-direction: column; gap: 12px;">
                                    ${recentAchievements.map(achievement => {
                                        const cert = certifications.find(c => c.id === achievement.certificationId);
                                        return `
                                            <div style="padding: 12px; border: 1px solid #e5e7eb; border-radius: 8px; background: #f9fafb;">
                                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                                    <h4 style="font-size: 0.9rem; font-weight: 600; color: #1a1a1a; margin: 0;">${cert?.name || '不明な資格'}</h4>
                                                    <span style="font-size: 0.75rem; color: #10b981; font-weight: 600;">✓ 取得済み</span>
                                                </div>
                                                <p style="font-size: 0.75rem; color: #6b7280; margin: 0;">取得日: ${new Date(achievement.achievedDate).toLocaleDateString('ja-JP')}</p>
                                            </div>
                                        `;
                                    }).join('')}
                                </div>
                            `}
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.getElementById('pageContent').innerHTML = html;
    } catch (error) {
        console.error('Dashboard loading error:', error);
        document.getElementById('pageContent').innerHTML = `
            <div class="card" style="margin: 24px;">
                <p style="color: #dc3545;">ダッシュボードの読み込みでエラーが発生しました: ${error.message}</p>
            </div>
        `;
    }
}

// 資格管理
async function loadCertifications() {
    try {
        const data = await apiCall('/api/certifications');
        const certifications = data.data.certifications;
        
        const categoryMap = {
            cloud: 'クラウド',
            security: 'セキュリティ',
            programming: 'プログラミング',
            database: 'データベース',
            network: 'ネットワーク',
            project_management: 'プロジェクト管理'
        };
        
        const html = `
            <div style="height: calc(100vh - 80px); padding: 24px; display: flex; flex-direction: column; max-width: 1600px; margin: 0 auto;">
                <div style="margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h1 style="font-size: 2rem; font-weight: 700; color: #1a1a1a; margin-bottom: 4px;">資格管理</h1>
                        <p style="font-size: 0.95rem; color: #6b7280;">登録されている資格一覧</p>
                    </div>
                    ${currentUser.role === 'admin' ? `
                        <button class="btn btn-primary" onclick="openCertificationModal()">
                            新規資格追加
                        </button>
                    ` : ''}
                </div>
                
                <div style="flex: 1; overflow: auto;">
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 20px;">
                        ${certifications.map(cert => `
                            <div class="card" style="padding: 24px; cursor: pointer; transition: all 0.3s ease;">
                                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 16px;">
                                    <div style="flex: 1;">
                                        <h3 style="font-size: 1.25rem; font-weight: 700; color: #1a1a1a; margin-bottom: 8px;">${cert.name}</h3>
                                        <p style="font-size: 0.9rem; color: #6b7280; margin-bottom: 12px;">${cert.issuer}</p>
                                    </div>
                                    ${currentUser.role === 'admin' ? `
                                        <div style="display: flex; gap: 8px;">
                                            <button class="btn" style="padding: 4px 8px; font-size: 0.8rem;" onclick="editCertification('${cert.id}')">編集</button>
                                            <button class="btn btn-danger" style="padding: 4px 8px; font-size: 0.8rem;" onclick="deleteCertification('${cert.id}', '${cert.name}')">削除</button>
                                        </div>
                                    ` : ''}
                                </div>
                                <div style="display: flex; gap: 8px; margin-bottom: 12px;">
                                    <span class="badge badge-info">${categoryMap[cert.category] || cert.category}</span>
                                    <span class="badge badge-warning">${'★'.repeat(cert.difficulty)}</span>
                                </div>
                                <p style="font-size: 0.85rem; color: #6b7280; line-height: 1.5; margin-bottom: 12px;">${cert.description || '説明なし'}</p>
                                <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 12px; border-top: 1px solid #e5e7eb;">
                                    <span style="font-size: 0.85rem; color: #6b7280;">有効期限: ${cert.validityPeriod ? `${cert.validityPeriod}ヶ月` : '無期限'}</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
        
        document.getElementById('pageContent').innerHTML = html;
    } catch (error) {
        document.getElementById('pageContent').innerHTML = `
            <div class="card" style="margin: 24px;">
                <p style="color: #dc3545;">エラーが発生しました: ${error.message}</p>
            </div>
        `;
    }
}

// 学習計画
async function loadStudyPlans() {
    try {
        const [plansRes, certsRes] = await Promise.all([
            currentUser.role === 'admin' ? apiCall('/api/study-plans') : apiCall('/api/study-plans/my'),
            apiCall('/api/certifications')
        ]);
        
        const plans = plansRes.data.plans;
        const certifications = certsRes.data.certifications;
        
        const statusMap = {
            planning: '計画中',
            in_progress: '進行中',
            completed: '完了',
            cancelled: 'キャンセル'
        };
        
        const statusColorMap = {
            planning: '#3b82f6',
            in_progress: '#f59e0b',
            completed: '#10b981',
            cancelled: '#ef4444'
        };
        
        const html = `
            <div style="height: calc(100vh - 80px); padding: 24px; display: flex; flex-direction: column; max-width: 1600px; margin: 0 auto;">
                <div style="margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h1 style="font-size: 2rem; font-weight: 700; color: #1a1a1a; margin-bottom: 4px;">学習計画</h1>
                        <p style="font-size: 0.95rem; color: #6b7280;">${currentUser.role === 'admin' ? '全ての' : 'あなたの'}学習計画</p>
                    </div>
                    <button class="btn btn-primary" onclick="openStudyPlanModal()">
                        新規計画作成
                    </button>
                </div>
                
                <div style="flex: 1; overflow: auto;">
                    ${plans.length === 0 ? `
                        <div class="card" style="padding: 48px; text-align: center;">
                            <p style="color: #9ca3af; font-size: 1.1rem;">学習計画がありません</p>
                        </div>
                    ` : `
                        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(400px, 1fr)); gap: 20px;">
                            ${plans.map(plan => {
                                const cert = certifications.find(c => c.id === plan.certificationId);
                                return `
                                    <div class="card" style="padding: 24px;">
                                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 16px;">
                                            <h3 style="font-size: 1.25rem; font-weight: 700; color: #1a1a1a; flex: 1;">${cert?.name || '不明な資格'}</h3>
                                            <div style="display: flex; gap: 8px; align-items: center;">
                                                <span style="padding: 4px 12px; border-radius: 12px; font-size: 0.85rem; font-weight: 600; background-color: ${statusColorMap[plan.status]}20; color: ${statusColorMap[plan.status]};">
                                                    ${statusMap[plan.status]}
                                                </span>
                                                <div style="display: flex; gap: 4px;">
                                                    <button class="btn" style="padding: 4px 8px; font-size: 0.8rem;" onclick="editStudyPlan('${plan.id}')">編集</button>
                                                    <button class="btn btn-danger" style="padding: 4px 8px; font-size: 0.8rem;" onclick="deleteStudyPlan('${plan.id}', '${cert?.name || '不明な資格'}')">削除</button>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div style="margin-bottom: 16px;">
                                            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                                                <span style="font-size: 0.85rem; color: #6b7280;">進捗状況</span>
                                                <span style="font-size: 0.85rem; font-weight: 600; color: #1a1a1a;">${plan.progress}%</span>
                                            </div>
                                            <div class="progress-bar" style="height: 12px;">
                                                <div class="progress-fill" style="width: ${plan.progress}%; background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);"></div>
                                            </div>
                                        </div>
                                        
                                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
                                            <div>
                                                <p style="font-size: 0.75rem; color: #9ca3af; margin-bottom: 4px;">開始日</p>
                                                <p style="font-size: 0.9rem; font-weight: 600; color: #1a1a1a;">${new Date(plan.startDate).toLocaleDateString('ja-JP')}</p>
                                            </div>
                                            <div>
                                                <p style="font-size: 0.75rem; color: #9ca3af; margin-bottom: 4px;">目標日</p>
                                                <p style="font-size: 0.9rem; font-weight: 600; color: #1a1a1a;">${new Date(plan.targetDate).toLocaleDateString('ja-JP')}</p>
                                            </div>
                                        </div>
                                        
                                        ${plan.notes ? `
                                            <div style="margin-top: 12px; padding: 12px; background-color: #f9fafb; border-radius: 8px;">
                                                <p style="font-size: 0.85rem; color: #6b7280; line-height: 1.5;">${plan.notes}</p>
                                            </div>
                                        ` : ''}
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    `}
                </div>
            </div>
        `;
        
        document.getElementById('pageContent').innerHTML = html;
    } catch (error) {
        document.getElementById('pageContent').innerHTML = `
            <div class="card" style="margin: 24px;">
                <p style="color: #dc3545;">エラーが発生しました: ${error.message}</p>
            </div>
        `;
    }
}

// 取得履歴
async function loadAchievements() {
    try {
        const [achievementsRes, certsRes] = await Promise.all([
            currentUser.role === 'admin' ? apiCall('/api/achievements') : apiCall('/api/achievements/my'),
            apiCall('/api/certifications')
        ]);
        
        console.log('Achievements response:', achievementsRes);
        console.log('Certifications response:', certsRes);
        
        const achievements = achievementsRes.data?.achievements || [];
        const certifications = certsRes.data?.certifications || [];
        
        const html = `
            <div style="height: calc(100vh - 80px); padding: 24px; display: flex; flex-direction: column; max-width: 1600px; margin: 0 auto;">
                <div style="margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h1 style="font-size: 2rem; font-weight: 700; color: #1a1a1a; margin-bottom: 4px;">取得履歴</h1>
                        <p style="font-size: 0.95rem; color: #6b7280;">${currentUser.role === 'admin' ? '全ての' : 'あなたの'}資格取得履歴</p>
                    </div>
                    <button class="btn btn-primary" onclick="openAchievementModal()">
                        新規取得報告
                    </button>
                </div>
                
                <div style="flex: 1; overflow: auto;">
                    ${achievements.length === 0 ? `
                        <div class="card" style="padding: 48px; text-align: center;">
                            <p style="color: #9ca3af; font-size: 1.1rem;">取得履歴がありません</p>
                        </div>
                    ` : `
                        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 20px;">
                            ${achievements.map(achievement => {
                                const cert = certifications.find(c => c.id === achievement.certificationId);
                                const isExpiringSoon = achievement.expiryDate && 
                                    new Date(achievement.expiryDate) - new Date() < 90 * 24 * 60 * 60 * 1000;
                                
                                return `
                                    <div class="card" style="padding: 24px; ${!achievement.isActive ? 'opacity: 0.6;' : ''}">
                                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 16px;">
                                            <h3 style="font-size: 1.25rem; font-weight: 700; color: #1a1a1a; flex: 1;">${cert?.name || '不明な資格'}</h3>
                                            <div style="display: flex; gap: 8px; align-items: center;">
                                                <span class="badge ${achievement.isActive ? 'badge-success' : 'badge-danger'}">
                                                    ${achievement.isActive ? '有効' : '無効'}
                                                </span>
                                                <div style="display: flex; gap: 4px;">
                                                    <button class="btn" style="padding: 4px 8px; font-size: 0.8rem;" onclick="editAchievement('${achievement.id}')">編集</button>
                                                    <button class="btn btn-danger" style="padding: 4px 8px; font-size: 0.8rem;" onclick="deleteAchievement('${achievement.id}', '${cert?.name || '不明な資格'}')">削除</button>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div style="margin-bottom: 16px;">
                                            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                                                <span style="font-size: 0.85rem; color: #6b7280;">取得日:</span>
                                                <span style="font-size: 0.9rem; font-weight: 600; color: #1a1a1a;">
                                                    ${new Date(achievement.achievedDate).toLocaleDateString('ja-JP')}
                                                </span>
                                            </div>
                                            
                                            ${achievement.expiryDate ? `
                                                <div style="display: flex; align-items: center; gap: 8px;">
                                                    <span style="font-size: 0.85rem; color: #6b7280;">有効期限:</span>
                                                    <span style="font-size: 0.9rem; font-weight: 600; color: ${isExpiringSoon ? '#ef4444' : '#1a1a1a'};">
                                                        ${new Date(achievement.expiryDate).toLocaleDateString('ja-JP')}
                                                        ${isExpiringSoon ? ' ⚠️' : ''}
                                                    </span>
                                                </div>
                                            ` : `
                                                <div style="display: flex; align-items: center; gap: 8px;">
                                                    <span style="font-size: 0.85rem; color: #6b7280;">有効期限:</span>
                                                    <span style="font-size: 0.9rem; font-weight: 600; color: #10b981;">無期限</span>
                                                </div>
                                            `}
                                        </div>
                                        
                                        ${achievement.certificationNumber ? `
                                            <div style="padding: 12px; background-color: #f9fafb; border-radius: 8px; margin-bottom: 12px;">
                                                <p style="font-size: 0.75rem; color: #9ca3af; margin-bottom: 4px;">認定番号</p>
                                                <p style="font-size: 0.9rem; font-weight: 600; color: #1a1a1a; font-family: monospace;">${achievement.certificationNumber}</p>
                                            </div>
                                        ` : ''}
                                        
                                        ${achievement.score ? `
                                            <div style="display: flex; align-items: center; gap: 8px; padding-top: 12px; border-top: 1px solid #e5e7eb;">
                                                <span style="font-size: 0.85rem; color: #6b7280;">スコア:</span>
                                                <span style="font-size: 1.1rem; font-weight: 700; color: #667eea;">${achievement.score}</span>
                                            </div>
                                        ` : ''}
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    `}
                </div>
            </div>
        `;
        
        document.getElementById('pageContent').innerHTML = html;
    } catch (error) {
        console.error('Error loading achievements:', error);
        document.getElementById('pageContent').innerHTML = `
            <div class="card" style="margin: 24px;">
                <p style="color: #dc3545;">エラーが発生しました: ${error.message}</p>
            </div>
        `;
    }
}

// ユーザー管理
async function loadUsers() {
    try {
        const data = await apiCall('/api/users');
        const users = data.data.users;
        
        const html = `
            <div style="height: calc(100vh - 80px); padding: 24px; display: flex; flex-direction: column; max-width: 1600px; margin: 0 auto;">
                <div style="margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h1 style="font-size: 2rem; font-weight: 700; color: #1a1a1a; margin-bottom: 4px;">ユーザー管理</h1>
                        <p style="font-size: 0.95rem; color: #6b7280;">登録されているユーザー一覧</p>
                    </div>
                    <button class="btn btn-primary" onclick="openUserModal()">
                        新規ユーザー作成
                    </button>
                </div>
                
                <div style="flex: 1; overflow: auto;">
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px;">
                        ${users.map(user => `
                            <div class="card" style="padding: 24px;">
                                <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 16px;">
                                    <div style="width: 60px; height: 60px; border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; color: white; font-size: 1.5rem; font-weight: 700;">
                                        ${user.name.charAt(0)}
                                    </div>
                                    <div style="flex: 1;">
                                        <h3 style="font-size: 1.1rem; font-weight: 700; color: #1a1a1a; margin-bottom: 4px;">${user.name}</h3>
                                        <p style="font-size: 0.85rem; color: #6b7280;">${user.email}</p>
                                    </div>
                                    <div style="display: flex; gap: 4px;">
                                        <button class="btn" style="padding: 4px 8px; font-size: 0.8rem;" onclick="editUser('${user.id}')">編集</button>
                                        ${user.id !== currentUser.id ? `
                                            <button class="btn btn-danger" style="padding: 4px 8px; font-size: 0.8rem;" onclick="deleteUser('${user.id}', '${user.name}')">削除</button>
                                        ` : ''}
                                    </div>
                                </div>
                                
                                <div style="display: flex; gap: 8px; margin-bottom: 16px;">
                                    <span class="badge ${user.role === 'admin' ? 'badge-danger' : 'badge-info'}">
                                        ${user.role === 'admin' ? '管理者' : 'メンバー'}
                                    </span>
                                </div>
                                
                                <div style="padding-top: 16px; border-top: 1px solid #e5e7eb;">
                                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                                        <span style="font-size: 0.85rem; color: #6b7280;">登録日</span>
                                        <span style="font-size: 0.85rem; font-weight: 600; color: #1a1a1a;">
                                            ${new Date(user.createdAt).toLocaleDateString('ja-JP')}
                                        </span>
                                    </div>
                                    <div style="display: flex; justify-content: space-between;">
                                        <span style="font-size: 0.85rem; color: #6b7280;">最終ログイン</span>
                                        <span style="font-size: 0.85rem; font-weight: 600; color: #1a1a1a;">
                                            ${user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString('ja-JP') : '未ログイン'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
        
        document.getElementById('pageContent').innerHTML = html;
    } catch (error) {
        document.getElementById('pageContent').innerHTML = `
            <div class="card" style="margin: 24px;">
                <p style="color: #dc3545;">エラーが発生しました: ${error.message}</p>
            </div>
        `;
    }
}

// 初期化処理とイベントリスナー登録
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded event fired');
    
    // ログイン処理
    const loginForm = document.getElementById('loginForm');
    console.log('Login form element:', loginForm);
    
    if (loginForm) {
        console.log('Adding submit event listener to login form');
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('Login form submitted');
            
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            const errorDiv = document.getElementById('loginError');
            
            console.log('Login attempt:', email);
            
            try {
                const data = await apiCall('/api/auth/login', {
                    method: 'POST',
                    body: JSON.stringify({ email, password })
                });
                
                console.log('Login response:', data);
                
                if (data.success) {
                    currentUser = data.data.user;
                    sessionId = data.data.sessionId;
                    
                    console.log('Login successful, switching screens');
                    
                    // 画面切り替え
                    document.getElementById('loginScreen').classList.add('hidden');
                    document.getElementById('appScreen').classList.remove('hidden');
                    
                    // ユーザー情報表示
                    document.getElementById('userInfo').textContent = 
                        `${currentUser.name} (${currentUser.role === 'admin' ? '管理者' : 'メンバー'})`;
                    
                    // 管理者専用メニューの表示制御
                    const adminOnlyElements = document.querySelectorAll('.admin-only');
                    adminOnlyElements.forEach(el => {
                        el.style.display = currentUser.role === 'admin' ? '' : 'none';
                    });
                    
                    // ダッシュボードを表示
                    loadPage('dashboard');
                }
            } catch (error) {
                console.error('Login error:', error);
                errorDiv.textContent = error.message;
                errorDiv.classList.remove('hidden');
            }
        });
    } else {
        console.error('Login form not found!');
    }
    
    // ログアウト処理
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            
            try {
                await apiCall('/api/auth/logout', { method: 'POST' });
            } catch (error) {
                console.error('Logout error:', error);
            }
            
            currentUser = null;
            sessionId = null;
            
            document.getElementById('appScreen').classList.add('hidden');
            document.getElementById('loginScreen').classList.remove('hidden');
        });
    }
    
    // ページナビゲーション
    document.querySelectorAll('.nav-link[data-page]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = e.target.dataset.page;
            loadPage(page);
        });
    });
});

// CRUD機能 - 資格管理
function openCertificationModal(certificationId = null, certification = null) {
    const isEdit = certificationId !== null;
    const title = isEdit ? '資格編集' : '新規資格追加';
    
    const modalHtml = `
        <div class="modal" id="certificationModal">
            <div class="modal-content">
                <h3>${title}</h3>
                <form id="certificationForm">
                    <div class="form-group">
                        <label class="form-label" for="certName">資格名 *</label>
                        <input type="text" id="certName" class="form-control" value="${certification?.name || ''}" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="certIssuer">発行機関 *</label>
                        <input type="text" id="certIssuer" class="form-control" value="${certification?.issuer || ''}" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="certCategory">カテゴリ *</label>
                        <select id="certCategory" class="form-control" required>
                            <option value="">選択してください</option>
                            <option value="cloud" ${certification?.category === 'cloud' ? 'selected' : ''}>クラウド</option>
                            <option value="security" ${certification?.category === 'security' ? 'selected' : ''}>セキュリティ</option>
                            <option value="programming" ${certification?.category === 'programming' ? 'selected' : ''}>プログラミング</option>
                            <option value="database" ${certification?.category === 'database' ? 'selected' : ''}>データベース</option>
                            <option value="network" ${certification?.category === 'network' ? 'selected' : ''}>ネットワーク</option>
                            <option value="project_management" ${certification?.category === 'project_management' ? 'selected' : ''}>プロジェクト管理</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="certDifficulty">難易度 *</label>
                        <select id="certDifficulty" class="form-control" required>
                            <option value="">選択してください</option>
                            <option value="1" ${certification?.difficulty === 1 ? 'selected' : ''}>★ (初級)</option>
                            <option value="2" ${certification?.difficulty === 2 ? 'selected' : ''}>★★ (初中級)</option>
                            <option value="3" ${certification?.difficulty === 3 ? 'selected' : ''}>★★★ (中級)</option>
                            <option value="4" ${certification?.difficulty === 4 ? 'selected' : ''}>★★★★ (中上級)</option>
                            <option value="5" ${certification?.difficulty === 5 ? 'selected' : ''}>★★★★★ (上級)</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="certDescription">説明</label>
                        <textarea id="certDescription" class="form-control" rows="3">${certification?.description || ''}</textarea>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="certValidityPeriod">有効期限（ヶ月）</label>
                        <input type="number" id="certValidityPeriod" class="form-control" value="${certification?.validityPeriod || ''}" min="1" max="120">
                        <small style="color: #6b7280;">空白の場合は無期限</small>
                    </div>
                    <div style="display: flex; gap: 12px; margin-top: 24px;">
                        <button type="submit" class="btn btn-primary">${isEdit ? '更新' : '作成'}</button>
                        <button type="button" class="btn btn-secondary" onclick="closeCertificationModal()">キャンセル</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // フォーム送信処理
    document.getElementById('certificationForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = {
            name: document.getElementById('certName').value,
            issuer: document.getElementById('certIssuer').value,
            category: document.getElementById('certCategory').value,
            difficulty: parseInt(document.getElementById('certDifficulty').value),
            description: document.getElementById('certDescription').value,
            validityPeriod: document.getElementById('certValidityPeriod').value ? parseInt(document.getElementById('certValidityPeriod').value) : null
        };
        
        try {
            if (isEdit) {
                await apiCall(`/api/certifications/${certificationId}`, {
                    method: 'PUT',
                    body: JSON.stringify(formData)
                });
            } else {
                await apiCall('/api/certifications', {
                    method: 'POST',
                    body: JSON.stringify(formData)
                });
            }
            
            closeCertificationModal();
            loadCertifications(); // リロード
        } catch (error) {
            alert(`エラーが発生しました: ${error.message}`);
        }
    });
}

function closeCertificationModal() {
    const modal = document.getElementById('certificationModal');
    if (modal) {
        modal.remove();
    }
}

async function editCertification(certificationId) {
    try {
        const data = await apiCall(`/api/certifications/${certificationId}`);
        const certification = data.data.certification;
        openCertificationModal(certificationId, certification);
    } catch (error) {
        alert(`エラーが発生しました: ${error.message}`);
    }
}

async function deleteCertification(certificationId, certificationName) {
    if (!confirm(`「${certificationName}」を削除しますか？この操作は取り消せません。`)) {
        return;
    }
    
    try {
        await apiCall(`/api/certifications/${certificationId}`, {
            method: 'DELETE'
        });
        loadCertifications(); // リロード
    } catch (error) {
        alert(`エラーが発生しました: ${error.message}`);
    }
}

// CRUD機能 - 学習計画管理
function openStudyPlanModal(planId = null) {
    const isEdit = planId !== null;
    const title = isEdit ? '学習計画編集' : '新規学習計画作成';
    
    // 資格一覧を取得してセレクトボックスに表示
    apiCall('/api/certifications').then(certData => {
        const certifications = certData.data.certifications;
        
        const modalHtml = `
            <div class="modal" id="studyPlanModal">
                <div class="modal-content">
                    <h3>${title}</h3>
                    <form id="studyPlanForm">
                        <div class="form-group">
                            <label class="form-label" for="planCertification">資格 *</label>
                            <select id="planCertification" class="form-control" required>
                                <option value="">選択してください</option>
                                ${certifications.map(cert => `
                                    <option value="${cert.id}">${cert.name} (${cert.issuer})</option>
                                `).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="planStartDate">開始日 *</label>
                            <input type="date" id="planStartDate" class="form-control" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="planTargetDate">目標取得日 *</label>
                            <input type="date" id="planTargetDate" class="form-control" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="planProgress">進捗率 (%)</label>
                            <input type="number" id="planProgress" class="form-control" value="0" min="0" max="100">
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="planStatus">ステータス</label>
                            <select id="planStatus" class="form-control">
                                <option value="planning">計画中</option>
                                <option value="in_progress">進行中</option>
                                <option value="completed">完了</option>
                                <option value="cancelled">キャンセル</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="planNotes">メモ</label>
                            <textarea id="planNotes" class="form-control" rows="3"></textarea>
                        </div>
                        <div style="display: flex; gap: 12px; margin-top: 24px;">
                            <button type="submit" class="btn btn-primary">${isEdit ? '更新' : '作成'}</button>
                            <button type="button" class="btn btn-secondary" onclick="closeStudyPlanModal()">キャンセル</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // フォーム送信処理
        document.getElementById('studyPlanForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = {
                certificationId: document.getElementById('planCertification').value,
                startDate: document.getElementById('planStartDate').value,
                targetDate: document.getElementById('planTargetDate').value,
                progress: parseInt(document.getElementById('planProgress').value) || 0,
                status: document.getElementById('planStatus').value,
                notes: document.getElementById('planNotes').value
            };
            
            try {
                if (isEdit) {
                    await apiCall(`/api/study-plans/${planId}`, {
                        method: 'PUT',
                        body: JSON.stringify(formData)
                    });
                } else {
                    await apiCall('/api/study-plans', {
                        method: 'POST',
                        body: JSON.stringify(formData)
                    });
                }
                
                closeStudyPlanModal();
                loadStudyPlans(); // リロード
            } catch (error) {
                alert(`エラーが発生しました: ${error.message}`);
            }
        });
    });
}

function closeStudyPlanModal() {
    const modal = document.getElementById('studyPlanModal');
    if (modal) {
        modal.remove();
    }
}

async function deleteStudyPlan(planId, certificationName) {
    if (!confirm(`「${certificationName}」の学習計画を削除しますか？`)) {
        return;
    }
    
    try {
        await apiCall(`/api/study-plans/${planId}`, {
            method: 'DELETE'
        });
        loadStudyPlans(); // リロード
    } catch (error) {
        alert(`エラーが発生しました: ${error.message}`);
    }
}

// CRUD機能 - 取得履歴管理
function openAchievementModal(achievementId = null) {
    const isEdit = achievementId !== null;
    const title = isEdit ? '取得履歴編集' : '新規取得報告';
    
    // 資格一覧を取得してセレクトボックスに表示
    apiCall('/api/certifications').then(certData => {
        const certifications = certData.data.certifications;
        
        const modalHtml = `
            <div class="modal" id="achievementModal">
                <div class="modal-content">
                    <h3>${title}</h3>
                    <form id="achievementForm">
                        <div class="form-group">
                            <label class="form-label" for="achievementCertification">資格 *</label>
                            <select id="achievementCertification" class="form-control" required>
                                <option value="">選択してください</option>
                                ${certifications.map(cert => `
                                    <option value="${cert.id}">${cert.name} (${cert.issuer})</option>
                                `).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="achievementDate">取得日 *</label>
                            <input type="date" id="achievementDate" class="form-control" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="achievementNumber">認定番号</label>
                            <input type="text" id="achievementNumber" class="form-control">
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="achievementExpiryDate">有効期限</label>
                            <input type="date" id="achievementExpiryDate" class="form-control">
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="achievementScore">スコア</label>
                            <input type="number" id="achievementScore" class="form-control" min="0" max="1000">
                        </div>
                        <div style="display: flex; gap: 12px; margin-top: 24px;">
                            <button type="submit" class="btn btn-primary">${isEdit ? '更新' : '登録'}</button>
                            <button type="button" class="btn btn-secondary" onclick="closeAchievementModal()">キャンセル</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // フォーム送信処理
        document.getElementById('achievementForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = {
                certificationId: document.getElementById('achievementCertification').value,
                achievedDate: document.getElementById('achievementDate').value,
                certificationNumber: document.getElementById('achievementNumber').value || undefined,
                expiryDate: document.getElementById('achievementExpiryDate').value || undefined,
                score: document.getElementById('achievementScore').value ? parseInt(document.getElementById('achievementScore').value) : undefined
            };
            
            try {
                if (isEdit) {
                    await apiCall(`/api/achievements/${achievementId}`, {
                        method: 'PUT',
                        body: JSON.stringify(formData)
                    });
                } else {
                    await apiCall('/api/achievements', {
                        method: 'POST',
                        body: JSON.stringify(formData)
                    });
                }
                
                closeAchievementModal();
                loadAchievements(); // リロード
            } catch (error) {
                alert(`エラーが発生しました: ${error.message}`);
            }
        });
    });
}

function closeAchievementModal() {
    const modal = document.getElementById('achievementModal');
    if (modal) {
        modal.remove();
    }
}

async function deleteAchievement(achievementId, certificationName) {
    if (!confirm(`「${certificationName}」の取得履歴を削除しますか？`)) {
        return;
    }
    
    try {
        await apiCall(`/api/achievements/${achievementId}`, {
            method: 'DELETE'
        });
        loadAchievements(); // リロード
    } catch (error) {
        alert(`エラーが発生しました: ${error.message}`);
    }
}

// CRUD機能 - ユーザー管理（管理者のみ）
function openUserModal(userId = null) {
    const isEdit = userId !== null;
    const title = isEdit ? 'ユーザー編集' : '新規ユーザー作成';
    
    const modalHtml = `
        <div class="modal" id="userModal">
            <div class="modal-content">
                <h3>${title}</h3>
                <form id="userForm">
                    <div class="form-group">
                        <label class="form-label" for="userName">名前 *</label>
                        <input type="text" id="userName" class="form-control" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="userEmail">メールアドレス *</label>
                        <input type="email" id="userEmail" class="form-control" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="userRole">権限 *</label>
                        <select id="userRole" class="form-control" required>
                            <option value="">選択してください</option>
                            <option value="member">メンバー</option>
                            <option value="admin">管理者</option>
                        </select>
                    </div>
                    ${!isEdit ? `
                        <div class="form-group">
                            <label class="form-label" for="userPassword">初期パスワード *</label>
                            <input type="password" id="userPassword" class="form-control" required>
                        </div>
                    ` : ''}
                    <div style="display: flex; gap: 12px; margin-top: 24px;">
                        <button type="submit" class="btn btn-primary">${isEdit ? '更新' : '作成'}</button>
                        <button type="button" class="btn btn-secondary" onclick="closeUserModal()">キャンセル</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // フォーム送信処理
    document.getElementById('userForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = {
            name: document.getElementById('userName').value,
            email: document.getElementById('userEmail').value,
            role: document.getElementById('userRole').value
        };
        
        if (!isEdit) {
            formData.password = document.getElementById('userPassword').value;
        }
        
        try {
            if (isEdit) {
                await apiCall(`/api/users/${userId}`, {
                    method: 'PUT',
                    body: JSON.stringify(formData)
                });
            } else {
                await apiCall('/api/users', {
                    method: 'POST',
                    body: JSON.stringify(formData)
                });
            }
            
            closeUserModal();
            loadUsers(); // リロード
        } catch (error) {
            alert(`エラーが発生しました: ${error.message}`);
        }
    });
}

function closeUserModal() {
    const modal = document.getElementById('userModal');
    if (modal) {
        modal.remove();
    }
}

async function deleteUser(userId, userName) {
    if (!confirm(`「${userName}」を削除しますか？この操作は取り消せません。`)) {
        return;
    }
    
    try {
        await apiCall(`/api/users/${userId}`, {
            method: 'DELETE'
        });
        loadUsers(); // リロード
    } catch (error) {
        alert(`エラーが発生しました: ${error.message}`);
    }
}
// 編集機能の追加
async function editStudyPlan(planId) {
    try {
        console.log('Editing study plan:', planId);
        const data = await apiCall(`/api/study-plans/${planId}`);
        console.log('Study plan data received:', data);
        const plan = data.data.plan; // 統一されたレスポンス形式
        
        // 資格一覧を取得してセレクトボックスに表示
        const certData = await apiCall('/api/certifications');
        const certifications = certData.data.certifications;
        
        const modalHtml = `
            <div class="modal" id="editStudyPlanModal">
                <div class="modal-content">
                    <h3>学習計画編集</h3>
                    <form id="editStudyPlanForm">
                        <div class="form-group">
                            <label class="form-label" for="planCertification">資格 *</label>
                            <select id="planCertification" class="form-control" required>
                                <option value="">選択してください</option>
                                ${certifications.map(cert => `
                                    <option value="${cert.id}" ${cert.id === plan.certificationId ? 'selected' : ''}>${cert.name} (${cert.issuer})</option>
                                `).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="planStartDate">開始日 *</label>
                            <input type="date" id="planStartDate" class="form-control" value="${plan.startDate.split('T')[0]}" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="planTargetDate">目標取得日 *</label>
                            <input type="date" id="planTargetDate" class="form-control" value="${plan.targetDate.split('T')[0]}" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="planProgress">進捗率 (%)</label>
                            <input type="number" id="planProgress" class="form-control" value="${plan.progress}" min="0" max="100">
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="planStatus">ステータス</label>
                            <select id="planStatus" class="form-control">
                                <option value="planning" ${plan.status === 'planning' ? 'selected' : ''}>計画中</option>
                                <option value="in_progress" ${plan.status === 'in_progress' ? 'selected' : ''}>進行中</option>
                                <option value="completed" ${plan.status === 'completed' ? 'selected' : ''}>完了</option>
                                <option value="cancelled" ${plan.status === 'cancelled' ? 'selected' : ''}>キャンセル</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="planNotes">メモ</label>
                            <textarea id="planNotes" class="form-control" rows="3">${plan.notes || ''}</textarea>
                        </div>
                        <div style="display: flex; gap: 12px; margin-top: 24px;">
                            <button type="submit" class="btn btn-primary">更新</button>
                            <button type="button" class="btn btn-secondary" onclick="closeEditStudyPlanModal()">キャンセル</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // フォーム送信処理
        document.getElementById('editStudyPlanForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = {
                certificationId: document.getElementById('planCertification').value,
                startDate: document.getElementById('planStartDate').value,
                targetDate: document.getElementById('planTargetDate').value,
                progress: parseInt(document.getElementById('planProgress').value) || 0,
                status: document.getElementById('planStatus').value,
                notes: document.getElementById('planNotes').value
            };
            
            try {
                await apiCall(`/api/study-plans/${planId}`, {
                    method: 'PUT',
                    body: JSON.stringify(formData)
                });
                
                closeEditStudyPlanModal();
                loadStudyPlans(); // リロード
            } catch (error) {
                alert(`エラーが発生しました: ${error.message}`);
            }
        });
    } catch (error) {
        alert(`エラーが発生しました: ${error.message}`);
    }
}

// Close function for edit study plan modal
function closeEditStudyPlanModal() {
    const modal = document.getElementById('editStudyPlanModal');
    if (modal) {
        modal.remove();
    }
}

async function editAchievement(achievementId) {
    try {
        console.log('Editing achievement:', achievementId);
        const data = await apiCall(`/api/achievements/${achievementId}`);
        console.log('Achievement data received:', data);
        const achievement = data.data.achievement; // 統一されたレスポンス形式
        
        // 資格一覧を取得してセレクトボックスに表示
        const certData = await apiCall('/api/certifications');
        const certifications = certData.data.certifications;
        
        const modalHtml = `
            <div class="modal" id="editAchievementModal">
                <div class="modal-content">
                    <h3>取得履歴編集</h3>
                    <form id="editAchievementForm">
                        <div class="form-group">
                            <label class="form-label" for="achievementCertification">資格 *</label>
                            <select id="achievementCertification" class="form-control" required>
                                <option value="">選択してください</option>
                                ${certifications.map(cert => `
                                    <option value="${cert.id}" ${cert.id === achievement.certificationId ? 'selected' : ''}>${cert.name} (${cert.issuer})</option>
                                `).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="achievementDate">取得日 *</label>
                            <input type="date" id="achievementDate" class="form-control" value="${achievement.achievedDate.split('T')[0]}" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="achievementNumber">認定番号</label>
                            <input type="text" id="achievementNumber" class="form-control" value="${achievement.certificationNumber || ''}">
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="achievementExpiryDate">有効期限</label>
                            <input type="date" id="achievementExpiryDate" class="form-control" value="${achievement.expiryDate ? achievement.expiryDate.split('T')[0] : ''}">
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="achievementScore">スコア</label>
                            <input type="number" id="achievementScore" class="form-control" value="${achievement.score || ''}" min="0" max="1000">
                        </div>
                        <div style="display: flex; gap: 12px; margin-top: 24px;">
                            <button type="submit" class="btn btn-primary">更新</button>
                            <button type="button" class="btn btn-secondary" onclick="closeEditAchievementModal()">キャンセル</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // フォーム送信処理
        document.getElementById('editAchievementForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = {
                certificationId: document.getElementById('achievementCertification').value,
                achievedDate: document.getElementById('achievementDate').value,
                certificationNumber: document.getElementById('achievementNumber').value || undefined,
                expiryDate: document.getElementById('achievementExpiryDate').value || undefined,
                score: document.getElementById('achievementScore').value ? parseInt(document.getElementById('achievementScore').value) : undefined
            };
            
            try {
                await apiCall(`/api/achievements/${achievementId}`, {
                    method: 'PUT',
                    body: JSON.stringify(formData)
                });
                
                closeEditAchievementModal();
                loadAchievements(); // リロード
            } catch (error) {
                alert(`エラーが発生しました: ${error.message}`);
            }
        });
    } catch (error) {
        alert(`エラーが発生しました: ${error.message}`);
    }
}

// Close function for edit achievement modal
function closeEditAchievementModal() {
    const modal = document.getElementById('editAchievementModal');
    if (modal) {
        modal.remove();
    }
}

async function editUser(userId) {
    try {
        const data = await apiCall(`/api/users/${userId}`);
        const user = data.data.user;
        
        const modalHtml = `
            <div class="modal" id="userModal">
                <div class="modal-content">
                    <h3>ユーザー編集</h3>
                    <form id="userForm">
                        <div class="form-group">
                            <label class="form-label" for="userName">名前 *</label>
                            <input type="text" id="userName" class="form-control" value="${user.name}" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="userEmail">メールアドレス *</label>
                            <input type="email" id="userEmail" class="form-control" value="${user.email}" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="userRole">権限 *</label>
                            <select id="userRole" class="form-control" required>
                                <option value="">選択してください</option>
                                <option value="member" ${user.role === 'member' ? 'selected' : ''}>メンバー</option>
                                <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>管理者</option>
                            </select>
                        </div>
                        <div style="display: flex; gap: 12px; margin-top: 24px;">
                            <button type="submit" class="btn btn-primary">更新</button>
                            <button type="button" class="btn btn-secondary" onclick="closeUserModal()">キャンセル</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // フォーム送信処理
        document.getElementById('userForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = {
                name: document.getElementById('userName').value,
                email: document.getElementById('userEmail').value,
                role: document.getElementById('userRole').value
            };
            
            try {
                await apiCall(`/api/users/${userId}`, {
                    method: 'PUT',
                    body: JSON.stringify(formData)
                });
                
                closeUserModal();
                loadUsers(); // リロード
            } catch (error) {
                alert(`エラーが発生しました: ${error.message}`);
            }
        });
    } catch (error) {
        alert(`エラーが発生しました: ${error.message}`);
    }
}