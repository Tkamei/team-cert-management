console.log('GitHub Pages app.js loaded');

// グローバル状態
let currentUser = null;
let sessionId = null;
let currentPage = 'dashboard';
let storage = null;

// 初期化関数
async function initializeApp() {
    try {
        console.log('Initializing app...');
        
        // GitHub Storage 初期化
        storage = new GitHubStorage();
        
        // 既存のトークンがあるかチェック
        const token = localStorage.getItem('github_token');
        if (token) {
            try {
                await storage.authenticate();
                const userInfo = await storage.getCurrentUser();
                
                if (userInfo && userInfo.app) {
                    currentUser = userInfo.app;
                    sessionId = 'github-authenticated';
                    
                    // UI更新
                    updateUserInterface();
                    
                    // ダッシュボード表示
                    await loadPage('dashboard');
                    return;
                }
            } catch (error) {
                console.log('Token validation failed:', error);
                localStorage.removeItem('github_token');
            }
        }
        
        // ログイン画面表示
        showLoginScreen();
        
    } catch (error) {
        console.error('App initialization error:', error);
        showLoginScreen();
    }
}

// ログイン画面表示
function showLoginScreen() {
    document.getElementById('mainNav').style.display = 'none';
    document.getElementById('userInfo').style.display = 'none';
    
    document.getElementById('pageContent').innerHTML = `
        <div style="display: flex; justify-content: center; align-items: center; height: 70vh;">
            <div class="card" style="padding: 48px; text-align: center; max-width: 500px;">
                <h2 style="margin-bottom: 24px; color: #1a1a1a;">チーム資格管理システム</h2>
                <p style="margin-bottom: 32px; color: #6b7280; line-height: 1.6;">
                    GitHubアカウントでログインしてください<br>
                    <small>Personal Access Token が必要です</small>
                </p>
                <button class="btn btn-primary" onclick="loginWithGitHub()" style="width: 100%; margin-bottom: 16px;">
                    GitHubでログイン
                </button>
                <div style="margin-top: 24px; padding: 16px; background: #f3f4f6; border-radius: 8px; text-align: left;">
                    <h4 style="margin-bottom: 8px; font-size: 0.9rem;">初回ログイン手順:</h4>
                    <ol style="font-size: 0.8rem; color: #6b7280; line-height: 1.5;">
                        <li>GitHub Settings → Developer settings → Personal access tokens</li>
                        <li>Generate new token (classic)</li>
                        <li>「repo」スコープを選択</li>
                        <li>生成されたトークンをコピー</li>
                        <li>上のボタンをクリックしてトークンを入力</li>
                    </ol>
                </div>
            </div>
        </div>
    `;
}

// GitHub ログイン
async function loginWithGitHub() {
    try {
        await storage.loginWithGitHub();
        await initializeApp();
    } catch (error) {
        alert('ログインに失敗しました: ' + error.message);
    }
}

// ユーザーインターフェース更新
function updateUserInterface() {
    document.getElementById('mainNav').style.display = 'flex';
    document.getElementById('userInfo').style.display = 'flex';
    document.getElementById('userName').textContent = currentUser.name;
    
    // 管理者以外はユーザー管理を非表示
    const usersNav = document.getElementById('usersNav');
    if (currentUser.role !== 'admin') {
        usersNav.style.display = 'none';
    } else {
        usersNav.style.display = 'block';
    }
}

// ログアウト
function logout() {
    if (confirm('ログアウトしますか？')) {
        storage.logout();
    }
}

// API呼び出しヘルパー（GitHub Storage対応）
async function apiCall(endpoint, options = {}) {
    if (!storage) {
        throw new Error('Storage not initialized');
    }

    const method = options.method || 'GET';
    
    try {
        // 資格一覧
        if (endpoint === '/api/certifications') {
            const data = await storage.getCertifications();
            return { success: true, data };
        }
        
        // 学習計画一覧
        if (endpoint === '/api/study-plans' || endpoint === '/api/study-plans/my') {
            const data = await storage.getStudyPlans();
            let plans = data.studyPlans || [];
            
            // 管理者以外は自分の計画のみ
            if (endpoint === '/api/study-plans/my' && currentUser.role !== 'admin') {
                plans = plans.filter(plan => plan.userId === currentUser.id);
            }
            
            return { success: true, data: { plans } };
        }
        
        // 個別学習計画取得
        if (endpoint.startsWith('/api/study-plans/') && method === 'GET' && !endpoint.includes('/my')) {
            const planId = endpoint.split('/')[3];
            const plan = await storage.getStudyPlan(planId);
            return { success: true, data: { plan } };
        }
        
        // 学習計画更新
        if (endpoint.startsWith('/api/study-plans/') && method === 'PUT') {
            const planId = endpoint.split('/')[3];
            const updates = JSON.parse(options.body);
            const updatedPlan = await storage.updateStudyPlan(planId, updates);
            return { success: true, data: { plan: updatedPlan } };
        }
        
        // 取得履歴一覧
        if (endpoint === '/api/achievements' || endpoint === '/api/achievements/my') {
            const data = await storage.getAchievements();
            let achievements = data.achievements || [];
            
            // 管理者以外は自分の実績のみ
            if (endpoint === '/api/achievements/my' && currentUser.role !== 'admin') {
                achievements = achievements.filter(achievement => achievement.userId === currentUser.id);
            }
            
            return { success: true, data: { achievements } };
        }
        
        // 個別取得履歴取得
        if (endpoint.startsWith('/api/achievements/') && method === 'GET' && !endpoint.includes('/my')) {
            const achievementId = endpoint.split('/')[3];
            const achievement = await storage.getAchievement(achievementId);
            return { success: true, data: { achievement } };
        }
        
        // 取得履歴更新
        if (endpoint.startsWith('/api/achievements/') && method === 'PUT') {
            const achievementId = endpoint.split('/')[3];
            const updates = JSON.parse(options.body);
            const updatedAchievement = await storage.updateAchievement(achievementId, updates);
            return { success: true, data: { achievement: updatedAchievement } };
        }
        
        // 通知一覧（フォールバック）
        if (endpoint === '/api/notifications/my') {
            try {
                const data = await storage.getNotifications();
                return { success: true, data };
            } catch (error) {
                return { success: true, data: { notifications: [] } };
            }
        }
        
        throw new Error(`Endpoint not implemented: ${endpoint}`);
        
    } catch (error) {
        console.error('API call error:', error);
        throw new Error(error.message || 'API call failed');
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
        console.error('Page load error:', error);
        contentDiv.innerHTML = `<div class="error">エラーが発生しました: ${error.message}</div>`;
    }
}

// ナビゲーションクリックイベント
document.addEventListener('DOMContentLoaded', function() {
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('nav-link')) {
            e.preventDefault();
            const page = e.target.getAttribute('data-page');
            if (page) {
                loadPage(page);
            }
        }
    });
});

// ダッシュボード読み込み（簡略版）
async function loadDashboard() {
    try {
        // 各種データを並行取得
        const [certsRes, plansRes, achievementsRes, notificationsRes] = await Promise.all([
            apiCall('/api/certifications'),
            currentUser.role === 'admin' ? apiCall('/api/study-plans') : apiCall('/api/study-plans/my'),
            currentUser.role === 'admin' ? apiCall('/api/achievements') : apiCall('/api/achievements/my'),
            apiCall('/api/notifications/my').catch(() => ({ data: { notifications: [] } }))
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

        const html = `
            <div style="padding: 24px;">
                <div style="margin-bottom: 24px;">
                    <h1 style="font-size: 2rem; font-weight: 700; color: #1a1a1a; margin-bottom: 4px;">ダッシュボード</h1>
                    <p style="font-size: 0.95rem; color: #6b7280;">ようこそ、${currentUser.name}さん</p>
                </div>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 32px;">
                    <div class="card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 24px;">
                        <div style="font-size: 0.85rem; opacity: 0.9;">総資格数</div>
                        <div style="font-size: 2.5rem; font-weight: 800; margin: 12px 0;">${totalCertifications}</div>
                        <div style="font-size: 0.8rem; opacity: 0.9;">登録済み</div>
                    </div>
                    
                    <div class="card" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 24px;">
                        <div style="font-size: 0.85rem; opacity: 0.9;">進行中の計画</div>
                        <div style="font-size: 2.5rem; font-weight: 800; margin: 12px 0;">${activePlans}</div>
                        <div style="font-size: 0.8rem; opacity: 0.9;">アクティブ</div>
                    </div>
                    
                    <div class="card" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; padding: 24px;">
                        <div style="font-size: 0.85rem; opacity: 0.9;">取得済み資格</div>
                        <div style="font-size: 2.5rem; font-weight: 800; margin: 12px 0;">${activeAchievements}</div>
                        <div style="font-size: 0.8rem; opacity: 0.9;">有効</div>
                    </div>
                    
                    <div class="card" style="background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%); color: white; padding: 24px;">
                        <div style="font-size: 0.85rem; opacity: 0.9;">未読通知</div>
                        <div style="font-size: 2.5rem; font-weight: 800; margin: 12px 0;">${unreadNotifications}</div>
                        <div style="font-size: 0.8rem; opacity: 0.9;">新着</div>
                    </div>
                </div>
                
                <div class="card" style="padding: 24px;">
                    <h2 style="margin-bottom: 16px;">システム情報</h2>
                    <p>GitHub Pages + JSONファイル構成で動作中</p>
                    <p style="margin-top: 8px; color: #6b7280; font-size: 0.9rem;">
                        データは GitHub リポジトリに保存され、変更履歴が自動で記録されます。
                    </p>
                </div>
            </div>
        `;
        
        document.getElementById('pageContent').innerHTML = html;
    } catch (error) {
        console.error('Dashboard loading error:', error);
        document.getElementById('pageContent').innerHTML = `
            <div class="card" style="margin: 24px; padding: 24px;">
                <p style="color: #dc3545;">ダッシュボードの読み込みでエラーが発生しました: ${error.message}</p>
            </div>
        `;
    }
}

// 他のページ読み込み関数（プレースホルダー）
async function loadCertifications() {
    document.getElementById('pageContent').innerHTML = `
        <div class="card" style="padding: 24px;">
            <h2>資格管理</h2>
            <p>資格管理機能は実装中です。</p>
        </div>
    `;
}

async function loadStudyPlans() {
    document.getElementById('pageContent').innerHTML = `
        <div class="card" style="padding: 24px;">
            <h2>学習計画</h2>
            <p>学習計画機能は実装中です。</p>
        </div>
    `;
}

async function loadAchievements() {
    document.getElementById('pageContent').innerHTML = `
        <div class="card" style="padding: 24px;">
            <h2>取得履歴</h2>
            <p>取得履歴機能は実装中です。</p>
        </div>
    `;
}

async function loadUsers() {
    document.getElementById('pageContent').innerHTML = `
        <div class="card" style="padding: 24px;">
            <h2>ユーザー管理</h2>
            <p>ユーザー管理機能は実装中です。</p>
        </div>
    `;
}

// ページ読み込み時に初期化
window.addEventListener('load', initializeApp);