# GitHub Desktop セットアップガイド

## 📥 Step 1: GitHub Desktop インストール（3分）

### 1.1 ダウンロード
1. https://desktop.github.com/ にアクセス
2. 「Download for Windows」をクリック
3. ダウンロードした `GitHubDesktopSetup.exe` を実行

### 1.2 インストール
- 自動的にインストールが開始されます
- 完了後、GitHub Desktop が起動します

## 🔐 Step 2: GitHubアカウント連携（2分）

### 2.1 サインイン
1. GitHub Desktop で「Sign in to GitHub.com」をクリック
2. ブラウザが開くので、GitHubアカウントでログイン
3. 「Authorize desktop」をクリック
4. GitHub Desktop に戻る

### 2.2 Git設定確認
- Name と Email が自動設定されます
- 「Continue」をクリック

## 📁 Step 3: 既存プロジェクトをリポジトリ化（5分）

### 3.1 リポジトリ作成
1. GitHub Desktop で「File」→「Add local repository」をクリック
2. 「Choose...」をクリック
3. プロジェクトフォルダを選択: `Z:\Cursor` または `//192.168.0.56/Takao Kamei のパブリックフォルダ/Cursor`
4. 「The directory does not appear to be a Git repository」と表示される
5. 「create a repository」をクリック

### 3.2 リポジトリ情報入力
- **Name**: `team-cert-management`
- **Description**: `チーム資格管理システム - GitHub Pages版`
- **Local path**: 自動入力されている（変更不要）
- **Initialize this repository with a README**: チェックを外す（既にREADME.mdがあるため）
- **Git ignore**: None
- **License**: None
- 「Create repository」をクリック

## 📤 Step 4: 初回コミット＆公開（3分）

### 4.1 変更確認
- 左側に全ファイルが表示されます
- これが初回コミットの内容です

### 4.2 コミット
1. 左下の「Summary」に入力: `Initial commit - GitHub Pages setup`
2. 「Description」（オプション）: `チーム資格管理システムの初期セットアップ`
3. 「Commit to main」をクリック

### 4.3 GitHubに公開
1. 上部の「Publish repository」をクリック
2. 設定確認：
   - **Name**: `team-cert-management`
   - **Description**: `チーム資格管理システム`
   - **Keep this code private**: チェックを外す（Public にする）
   - **Organization**: None（個人アカウント）
3. 「Publish repository」をクリック

### 4.4 確認
- 「View on GitHub」をクリックしてブラウザで確認
- リポジトリが作成され、全ファイルがアップロードされています

## ⚙️ Step 5: GitHub Pages 設定（3分）

### 5.1 Settings へ移動
1. GitHubのリポジトリページで「Settings」タブをクリック
2. 左メニューから「Pages」をクリック

### 5.2 Pages 設定
1. **Source**: 「Deploy from a branch」を選択
2. **Branch**: 
   - ドロップダウンから「main」を選択
   - フォルダは「/docs」を選択
3. 「Save」をクリック

### 5.3 確認
- 数分後、ページ上部に緑色のバーが表示されます
- 「Your site is live at https://YOUR_USERNAME.github.io/team-cert-management/」
- URLをクリックして確認

## 🔑 Step 6: Personal Access Token 作成（5分）

### 6.1 Token 作成ページへ
1. GitHub右上のプロフィールアイコン → Settings
2. 左メニュー最下部の「Developer settings」
3. 「Personal access tokens」→「Tokens (classic)」
4. 「Generate new token」→「Generate new token (classic)」

### 6.2 Token 設定
- **Note**: `Team Cert Management - Full Access`
- **Expiration**: `No expiration`（または適切な期間）
- **Select scopes**: 
  - ✅ `repo` （全てのサブ項目も自動選択される）
- 「Generate token」をクリック

### 6.3 Token 保存
- 表示されたトークンをコピー（`ghp_` で始まる文字列）
- **重要**: このトークンは一度しか表示されません
- メモ帳などに保存しておく

## 📝 Step 7: 設定ファイル更新（10分）

### 7.1 GitHubユーザー名の設定

`api/github-storage.js` を開いて編集：

```javascript
constructor() {
    this.owner = 'YOUR_GITHUB_USERNAME'; // ← あなたのGitHubユーザー名に変更
    this.repo = 'team-cert-management';
    this.clientId = 'YOUR_OAUTH_CLIENT_ID'; // 後で設定
    this.token = null;
    this.branch = 'main';
}
```

### 7.2 ユーザーデータの設定

`data/users.json` を開いて編集：

```json
{
  "users": [
    {
      "id": "admin-user-1",
      "name": "亀井 隆雄",
      "email": "takao.kamei@your-domain.com",
      "role": "admin",
      "githubUsername": "YOUR_GITHUB_USERNAME",
      "createdAt": "2024-01-31T00:00:00.000Z",
      "updatedAt": "2024-01-31T00:00:00.000Z"
    },
    {
      "id": "member-1",
      "name": "メンバー1",
      "email": "member1@your-domain.com",
      "role": "member",
      "githubUsername": "member1-github-username",
      "createdAt": "2024-01-31T00:00:00.000Z",
      "updatedAt": "2024-01-31T00:00:00.000Z"
    }
  ]
}
```

### 7.3 変更をコミット＆プッシュ

GitHub Desktop で：
1. 変更されたファイルが表示される
2. Summary: `Update configuration with GitHub username`
3. 「Commit to main」をクリック
4. 上部の「Push origin」をクリック

## 🎉 Step 8: 動作確認（5分）

### 8.1 サイトにアクセス
1. `https://YOUR_USERNAME.github.io/team-cert-management/` を開く
2. ログイン画面が表示される

### 8.2 ログインテスト
1. 「GitHubでログイン」をクリック
2. Personal Access Token を入力
3. ダッシュボードが表示される

### 8.3 機能確認
- ダッシュボードの統計表示
- 各ページへの遷移
- データの表示

## 🔄 今後の更新方法

### ファイル変更時
1. ファイルを編集・保存
2. GitHub Desktop を開く
3. 変更内容を確認
4. Summary を入力
5. 「Commit to main」
6. 「Push origin」

### データ更新時
- アプリ内で更新すると自動的にGitHubにコミットされます
- GitHub Desktop で履歴を確認できます

## 📊 完了チェックリスト

- [ ] GitHub Desktop インストール完了
- [ ] GitHubアカウント連携完了
- [ ] リポジトリ作成・公開完了
- [ ] GitHub Pages 設定完了
- [ ] Personal Access Token 作成完了
- [ ] 設定ファイル更新完了
- [ ] サイトアクセス確認完了
- [ ] ログイン動作確認完了

## 🆘 トラブルシューティング

### GitHub Desktop でリポジトリが作成できない
- ネットワークドライブの場合、ローカルディスクにコピーしてから作成

### Pages が表示されない
- Settings > Pages で設定を再確認
- 5-10分待ってから再アクセス

### ログインできない
- Personal Access Token の `repo` スコープを確認
- トークンの有効期限を確認
- ブラウザのキャッシュをクリア

## 🎊 完了！

これで完全無料のチーム資格管理システムがインターネット上で動作しています！

**アクセスURL**: `https://YOUR_USERNAME.github.io/team-cert-management/`
**月額コスト**: ¥0
**管理工数**: 最小限