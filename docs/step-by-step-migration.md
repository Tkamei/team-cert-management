# GitHub Pages移行 ステップバイステップガイド

## 事前準備

### 必要なもの
- GitHubアカウント
- 現在のプロジェクトファイル
- 30分程度の作業時間

## Step 1: GitHubリポジトリ作成（5分）

### 1.1 新しいリポジトリ作成
1. GitHub.com にログイン
2. 右上の「+」→「New repository」
3. Repository name: `team-cert-management`
4. Description: `チーム資格管理システム`
5. Public を選択（GitHub Pages無料利用のため）
6. 「Create repository」をクリック

### 1.2 ローカルでGit初期化
```bash
# 現在のプロジェクトディレクトリで実行
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/team-cert-management.git
git push -u origin main
```

## Step 2: GitHub Pages設定（3分）

### 2.1 Pages設定
1. リポジトリページで「Settings」タブ
2. 左メニューから「Pages」
3. Source: 「Deploy from a branch」
4. Branch: 「main」を選択
5. Folder: 「/ (root)」を選択
6. 「Save」をクリック

### 2.2 アクセス確認
- 数分後に `https://YOUR_USERNAME.github.io/team-cert-management/` でアクセス可能

## Step 3: プロジェクト構造調整（10分）

### 3.1 GitHub Pages用ディレクトリ作成
```bash
# 現在のpublicフォルダの内容をdocsフォルダに移動
mkdir docs
cp -r public/* docs/
```

### 3.2 ファイル構成調整
```
team-cert-management/
├── docs/                    # GitHub Pages用（publicから移動）
│   ├── index.html
│   ├── app.js
│   └── style.css
├── data/                    # JSONデータ（既存のまま）
│   ├── users.json
│   ├── certifications.json
│   ├── achievements.json
│   ├── study_plans.json
│   └── notifications.json
├── api/                     # 新規作成
│   └── github-storage.js
└── README.md
```

### 3.3 Pages設定変更
1. GitHub リポジトリの Settings > Pages
2. Folder を「/docs」に変更
3. 「Save」をクリック

## Step 4: GitHub API連携コード追加（15分）

### 4.1 GitHub Storage クラス追加
```bash
# api/github-storage.js を作成
cp docs/github-api-storage.js api/github-storage.js
```

### 4.2 app.js の改修
既存の `apiCall` 関数を GitHub API 対応に変更：

```javascript
// docs/app.js の先頭に追加
// GitHub Storage インスタンス
let storage = null;

// 初期化関数
async function initializeApp() {
    try {
        // GitHub Storage 初期化
        storage = new GitHubStorage();
        await storage.authenticate();
        
        // 現在のユーザー取得
        const userInfo = await storage.getCurrentUser();
        if (userInfo && userInfo.app) {
            currentUser = userInfo.app;
            sessionId = 'github-authenticated';
            
            // ダッシュボード表示
            await loadPage('dashboard');
        } else {
            // ログイン画面表示
            showLoginScreen();
        }
    } catch (error) {
        console.error('App initialization error:', error);
        showLoginScreen();
    }
}

// ログイン画面表示
function showLoginScreen() {
    document.getElementById('pageContent').innerHTML = `
        <div style="display: flex; justify-content: center; align-items: center; height: 100vh;">
            <div class="card" style="padding: 48px; text-align: center; max-width: 400px;">
                <h2 style="margin-bottom: 24px;">チーム資格管理システム</h2>
                <p style="margin-bottom: 32px; color: #6b7280;">GitHubアカウントでログインしてください</p>
                <button class="btn btn-primary" onclick="loginWithGitHub()" style="width: 100%;">
                    GitHubでログイン
                </button>
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

// 既存のapiCall関数を置き換え
async function apiCall(endpoint, options = {}) {
    if (!storage) {
        throw new Error('Storage not initialized');
    }

    // エンドポイントに応じてGitHub Storage メソッドを呼び出し
    const method = options.method || 'GET';
    
    try {
        if (endpoint === '/api/certifications') {
            const data = await storage.getCertifications();
            return { success: true, data };
        }
        
        if (endpoint === '/api/study-plans' || endpoint === '/api/study-plans/my') {
            const data = await storage.getStudyPlans();
            // 現在のユーザーの計画のみフィルタ（管理者以外）
            if (endpoint === '/api/study-plans/my' && currentUser.role !== 'admin') {
                data.studyPlans = data.studyPlans.filter(plan => plan.userId === currentUser.id);
            }
            return { success: true, data: { plans: data.studyPlans } };
        }
        
        if (endpoint === '/api/achievements' || endpoint === '/api/achievements/my') {
            const data = await storage.getAchievements();
            // 現在のユーザーの実績のみフィルタ（管理者以外）
            if (endpoint === '/api/achievements/my' && currentUser.role !== 'admin') {
                data.achievements = data.achievements.filter(achievement => achievement.userId === currentUser.id);
            }
            return { success: true, data };
        }
        
        if (endpoint.startsWith('/api/study-plans/') && method === 'PUT') {
            const planId = endpoint.split('/')[3];
            const updates = JSON.parse(options.body);
            const updatedPlan = await storage.updateStudyPlan(planId, updates);
            return { success: true, data: { plan: updatedPlan } };
        }
        
        if (endpoint.startsWith('/api/achievements/') && method === 'PUT') {
            const achievementId = endpoint.split('/')[3];
            const updates = JSON.parse(options.body);
            const updatedAchievement = await storage.updateAchievement(achievementId, updates);
            return { success: true, data: { achievement: updatedAchievement } };
        }
        
        // その他のエンドポイントは既存のロジックを使用
        throw new Error(`Endpoint not implemented: ${endpoint}`);
        
    } catch (error) {
        throw new Error(error.message || 'API call failed');
    }
}

// ページ読み込み時に初期化
window.addEventListener('load', initializeApp);
```

## Step 5: GitHub OAuth App 設定（5分）

### 5.1 OAuth App 作成
1. GitHub Settings > Developer settings > OAuth Apps
2. 「New OAuth App」をクリック
3. 設定値：
   - Application name: `Team Cert Management`
   - Homepage URL: `https://YOUR_USERNAME.github.io/team-cert-management/`
   - Authorization callback URL: `https://YOUR_USERNAME.github.io/team-cert-management/`
4. 「Register application」をクリック
5. Client ID をメモ

### 5.2 Client ID 設定
```javascript
// api/github-storage.js の constructor 内で設定
constructor() {
    this.owner = 'YOUR_GITHUB_USERNAME';
    this.repo = 'team-cert-management';
    this.clientId = 'YOUR_OAUTH_CLIENT_ID'; // ここに設定
    this.token = null;
    this.branch = 'main';
}
```

## Step 6: Personal Access Token 設定（3分）

### 6.1 Token 作成
1. GitHub Settings > Developer settings > Personal access tokens > Tokens (classic)
2. 「Generate new token (classic)」
3. Note: `Team Cert Management`
4. Expiration: `No expiration`（または適切な期間）
5. Scopes: `repo` にチェック
6. 「Generate token」をクリック
7. トークンをコピー（一度しか表示されません）

### 6.2 Token 設定方法
```javascript
// 初回アクセス時にトークンを設定
localStorage.setItem('github_token', 'YOUR_PERSONAL_ACCESS_TOKEN');
```

## Step 7: デプロイとテスト（5分）

### 7.1 変更をプッシュ
```bash
git add .
git commit -m "Add GitHub Pages support with JSON storage"
git push origin main
```

### 7.2 動作確認
1. `https://YOUR_USERNAME.github.io/team-cert-management/` にアクセス
2. GitHubログインをテスト
3. データ表示を確認
4. データ更新をテスト

## Step 8: チームメンバー招待（2分）

### 8.1 リポジトリへの招待
1. リポジトリページで「Settings」
2. 「Manage access」
3. 「Invite a collaborator」
4. チームメンバーのGitHubユーザー名を入力
5. 「Write」権限で招待

### 8.2 ユーザーデータ追加
```json
// data/users.json に追加
{
  "users": [
    {
      "id": "user-1",
      "name": "管理者",
      "email": "admin@your-domain.com",
      "role": "admin",
      "githubUsername": "your-github-username",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    {
      "id": "user-2", 
      "name": "メンバー1",
      "email": "member1@your-domain.com",
      "role": "member",
      "githubUsername": "member1-github-username",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

## 完了！

これで GitHub Pages + JSONファイル構成での運用が開始できます。

### アクセス方法
- URL: `https://YOUR_USERNAME.github.io/team-cert-management/`
- 認証: GitHubアカウント
- データ: JSONファイル（Git履歴で変更追跡）

### 運用コスト
- **月額**: ¥0（完全無料）
- **管理工数**: 最小限
- **可用性**: GitHub Pages の可用性に依存

### 次のステップ
1. チームメンバーでの動作テスト
2. 必要に応じてUI調整
3. カスタムドメイン設定（オプション）