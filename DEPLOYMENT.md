# デプロイメントガイド

このドキュメントでは、チーム資格管理システムを本番環境にデプロイする手順を説明します。

## 目次

1. [デプロイメント前の準備](#デプロイメント前の準備)
2. [Renderへのデプロイ](#renderへのデプロイ)
3. [Railwayへのデプロイ](#railwayへのデプロイ)
4. [環境変数の設定](#環境変数の設定)
5. [データのバックアップと復元](#データのバックアップと復元)
6. [トラブルシューティング](#トラブルシューティング)
7. [ロールバック手順](#ロールバック手順)

---

## デプロイメント前の準備

### 1. GitHubリポジトリの作成

1. GitHubにログイン
2. 新しいリポジトリを作成
   - リポジトリ名: `team-cert-management`
   - 公開/非公開: お好みで選択
   - README、.gitignore、ライセンスは追加しない（既に存在するため）

3. ローカルリポジトリをGitHubにプッシュ

```bash
# Gitリポジトリの初期化（まだの場合）
git init

# リモートリポジトリの追加
git remote add origin https://github.com/YOUR_USERNAME/team-cert-management.git

# 全ファイルをステージング
git add .

# 初回コミット
git commit -m "Initial commit: Team Certification Management System"

# GitHubにプッシュ
git push -u origin main
```

### 2. ローカルでの本番ビルドテスト

デプロイ前に、ローカル環境で本番ビルドが正常に動作することを確認します。

```bash
# フロントエンドのビルド
cd client
npm run build
cd ..

# 本番モードでサーバー起動
NODE_ENV=production PORT=3000 npm start
```

ブラウザで `http://localhost:3000` にアクセスし、アプリケーションが正常に動作することを確認します。

---

## Renderへのデプロイ

Renderは無料プランでNode.jsアプリケーションをホスティングできるプラットフォームです。

### 手順

1. **Renderアカウントの作成**
   - https://render.com にアクセス
   - GitHubアカウントでサインアップ

2. **新しいWebサービスの作成**
   - ダッシュボードから「New +」→「Web Service」を選択
   - GitHubリポジトリを接続
   - `team-cert-management` リポジトリを選択

3. **サービス設定**
   - **Name**: `team-cert-management`（任意）
   - **Environment**: `Node`
   - **Build Command**: `npm install && cd client && npm install && npm run build && cd ..`
   - **Start Command**: `npm start`
   - **Plan**: `Free`

4. **環境変数の設定**（後述の「環境変数の設定」セクション参照）

5. **デプロイ**
   - 「Create Web Service」をクリック
   - 自動的にビルドとデプロイが開始されます
   - デプロイ完了後、RenderがURLを提供します（例: `https://team-cert-management.onrender.com`）

### Renderでの永続ストレージ設定

Renderの無料プランでは永続ストレージが提供されないため、データは再デプロイ時に失われます。

**対策オプション**:
1. **外部ストレージの使用**: AWS S3、Google Cloud Storageなど
2. **データベースへの移行**: PostgreSQL、MongoDBなど
3. **定期的なバックアップ**: GitHub Actionsで定期的にデータをコミット

---

## Railwayへのデプロイ

Railwayも無料プランでNode.jsアプリケーションをホスティングできます。

### 手順

1. **Railwayアカウントの作成**
   - https://railway.app にアクセス
   - GitHubアカウントでサインアップ

2. **新しいプロジェクトの作成**
   - 「New Project」をクリック
   - 「Deploy from GitHub repo」を選択
   - `team-cert-management` リポジトリを選択

3. **サービス設定**
   - Railwayが自動的にNode.jsプロジェクトを検出
   - ビルドコマンドとスタートコマンドは自動設定されます

4. **カスタムビルド設定（必要な場合）**
   
   プロジェクトルートに `railway.json` を作成：

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm install && cd client && npm install && npm run build && cd .."
  },
  "deploy": {
    "startCommand": "npm start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

5. **環境変数の設定**（後述の「環境変数の設定」セクション参照）

6. **デプロイ**
   - 設定完了後、自動的にデプロイが開始されます
   - デプロイ完了後、RailwayがURLを提供します

### Railwayでの永続ストレージ設定

Railwayでは永続ボリュームを追加できます：

1. プロジェクトダッシュボードで「+ New」→「Volume」を選択
2. マウントパス: `/app/data`
3. サイズ: 1GB（無料プラン）

---

## 環境変数の設定

本番環境で必要な環境変数を設定します。

### 必須の環境変数

| 変数名 | 値の例 | 説明 |
|--------|--------|------|
| `NODE_ENV` | `production` | 実行環境 |
| `PORT` | `3000` | サーバーポート（通常は自動設定） |
| `SESSION_SECRET` | `your-secure-random-string-here` | セッション暗号化キー（32文字以上推奨） |
| `DATA_DIR` | `./data` | データディレクトリパス |
| `CORS_ORIGIN` | `https://your-app.onrender.com` | CORS許可オリジン |
| `FRONTEND_BUILD_PATH` | `./client/build` | フロントエンドビルドパス |

### セッションシークレットの生成

安全なランダム文字列を生成：

```bash
# Node.jsで生成
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# またはオンラインツールを使用
# https://www.random.org/strings/
```

### Renderでの環境変数設定

1. Renderダッシュボードでサービスを選択
2. 「Environment」タブをクリック
3. 「Add Environment Variable」で各変数を追加
4. 「Save Changes」をクリック

### Railwayでの環境変数設定

1. Railwayダッシュボードでプロジェクトを選択
2. 「Variables」タブをクリック
3. 各変数を追加
4. 自動的に再デプロイされます

---

## データのバックアップと復元

### 手動バックアップ

```bash
# データディレクトリ全体をバックアップ
tar -czf backup-$(date +%Y%m%d-%H%M%S).tar.gz data/

# または個別ファイルをコピー
cp data/*.json backups/
```

### GitHubへのバックアップ

データをGitリポジトリにコミットする方法（注意: 機密データが含まれる場合は非推奨）：

```bash
# データファイルをステージング
git add data/*.json

# コミット
git commit -m "Backup: $(date +%Y-%m-%d)"

# プッシュ
git push origin main
```

### 自動バックアップ（GitHub Actions）

`.github/workflows/backup.yml` を作成：

```yaml
name: Data Backup

on:
  schedule:
    - cron: '0 0 * * *'  # 毎日午前0時（UTC）
  workflow_dispatch:  # 手動実行も可能

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Create backup
        run: |
          mkdir -p backups
          tar -czf backups/backup-$(date +%Y%m%d).tar.gz data/
      
      - name: Upload backup artifact
        uses: actions/upload-artifact@v3
        with:
          name: data-backup
          path: backups/
          retention-days: 30
```

### データの復元

```bash
# バックアップファイルから復元
tar -xzf backup-YYYYMMDD-HHMMSS.tar.gz

# または個別ファイルをコピー
cp backups/*.json data/
```

---

## トラブルシューティング

### 問題: アプリケーションが起動しない

**原因**: 環境変数が正しく設定されていない

**解決策**:
1. 環境変数が全て設定されているか確認
2. `SESSION_SECRET` が設定されているか確認
3. ログを確認して具体的なエラーメッセージを特定

```bash
# Renderの場合
# ダッシュボードの「Logs」タブを確認

# Railwayの場合
# ダッシュボードの「Deployments」→「View Logs」を確認
```

### 問題: フロントエンドが表示されない

**原因**: ビルドが正しく実行されていない、または静的ファイルのパスが間違っている

**解決策**:
1. ビルドログを確認して、フロントエンドのビルドが成功しているか確認
2. `FRONTEND_BUILD_PATH` 環境変数が正しいか確認
3. `client/build` ディレクトリが存在するか確認

### 問題: APIリクエストが失敗する

**原因**: CORS設定が正しくない

**解決策**:
1. `CORS_ORIGIN` 環境変数にデプロイ先のURLが含まれているか確認
2. フロントエンドのAPIリクエストURLが正しいか確認（相対パス `/api/...` を使用）

### 問題: データが保存されない

**原因**: データディレクトリへの書き込み権限がない、または永続ストレージが設定されていない

**解決策**:
1. データディレクトリが存在し、書き込み可能か確認
2. 永続ストレージ（ボリューム）が設定されているか確認
3. ログでファイルシステムエラーを確認

### 問題: セッションが維持されない

**原因**: セッションストアがメモリベースで、複数インスタンスで共有されていない

**解決策**:
1. 単一インスタンスで実行（無料プランの場合は通常これが該当）
2. または、Redisなどの外部セッションストアを使用

---

## ロールバック手順

デプロイ後に問題が発生した場合、以前のバージョンにロールバックできます。

### Renderでのロールバック

1. Renderダッシュボードでサービスを選択
2. 「Events」タブをクリック
3. 以前の成功したデプロイを見つける
4. 「Rollback」ボタンをクリック

### Railwayでのロールバック

1. Railwayダッシュボードでプロジェクトを選択
2. 「Deployments」タブをクリック
3. 以前の成功したデプロイを見つける
4. 「Redeploy」をクリック

### Gitを使用したロールバック

```bash
# 以前のコミットを確認
git log --oneline

# 特定のコミットにロールバック
git revert <commit-hash>

# または、強制的に以前の状態に戻す（注意: 履歴が失われます）
git reset --hard <commit-hash>
git push -f origin main
```

---

## デプロイメントチェックリスト

デプロイ前に以下を確認してください：

- [ ] 全ての環境変数が設定されている
- [ ] `SESSION_SECRET` が安全なランダム文字列である
- [ ] ローカルで本番ビルドが成功する
- [ ] 全てのテストが通過する
- [ ] データのバックアップが取られている
- [ ] `.gitignore` に機密情報が含まれていない
- [ ] README.mdとDEPLOYMENT.mdが最新である
- [ ] CORS設定が本番URLを含んでいる

---

## 更新とメンテナンス

### アプリケーションの更新

```bash
# 変更をコミット
git add .
git commit -m "Update: description of changes"

# GitHubにプッシュ
git push origin main

# RenderとRailwayは自動的に再デプロイします
```

### 依存関係の更新

```bash
# 依存関係の更新確認
npm outdated

# 依存関係の更新
npm update

# セキュリティ脆弱性の確認
npm audit

# セキュリティ脆弱性の修正
npm audit fix
```

---

## サポートとリソース

- **Renderドキュメント**: https://render.com/docs
- **Railwayドキュメント**: https://docs.railway.app
- **Node.jsドキュメント**: https://nodejs.org/docs
- **Expressドキュメント**: https://expressjs.com

問題が解決しない場合は、GitHubのIssuesで質問してください。


---

## Railway Configuration

Railway does not use a configuration file like Render. Instead, configuration is done through the Railway dashboard or CLI.

### Railway Setup Steps

1. **Create Railway Account**
   - Visit https://railway.app
   - Sign up with GitHub

2. **Create New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose `team-cert-management` repository

3. **Configure Build Settings**
   
   Railway will auto-detect Node.js, but you can customize:
   
   - **Build Command**: `npm install && cd client && npm install && npm run build && cd .. && npm run build:server`
   - **Start Command**: `npm start`
   - **Watch Paths**: Leave default (watches all files)

4. **Add Environment Variables**
   
   In the Railway dashboard, go to Variables tab and add:
   
   ```
   NODE_ENV=production
   SESSION_SECRET=<generate-secure-random-string>
   DATA_DIR=/app/data
   CORS_ORIGIN=https://your-app.up.railway.app
   FRONTEND_BUILD_PATH=./client/build
   LOG_LEVEL=info
   DEMO_MODE=true
   ```

5. **Add Persistent Volume (Optional)**
   
   For data persistence:
   - Go to "Volumes" tab
   - Click "New Volume"
   - Mount path: `/app/data`
   - Size: 1GB

6. **Deploy**
   
   Railway will automatically deploy on push to main branch.

### Railway CLI (Alternative Method)

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link to project
railway link

# Add environment variables
railway variables set NODE_ENV=production
railway variables set SESSION_SECRET=your-secret-here
railway variables set DATA_DIR=/app/data
railway variables set CORS_ORIGIN=https://your-app.up.railway.app

# Deploy
railway up
```

### Railway Pricing

- **Free Tier**: $5 credit per month (enough for small apps)
- **Pro Plan**: $20/month for more resources
- **Usage-based**: Pay only for what you use

---

## Vercel Configuration (Frontend Only)

If you want to deploy the frontend separately on Vercel and backend elsewhere:

### vercel.json

Create `client/vercel.json`:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "build"
      }
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "https://your-backend-url.com/api/$1"
    },
    {
      "src": "/(.*)",
      "dest": "/$1"
    }
  ]
}
```

### Vercel Setup

1. Import project from GitHub
2. Select `client` directory as root
3. Framework: React
4. Build command: `npm run build`
5. Output directory: `build`
6. Add environment variable: `VITE_API_URL=https://your-backend-url.com`

---

## Continuous Deployment Best Practices

### 1. Environment-Specific Configuration

Always use environment variables for:
- API endpoints
- Database connections
- Secret keys
- Feature flags

### 2. Automated Testing

Ensure tests run before deployment:
- Unit tests
- Integration tests
- Property-based tests (if implemented)

### 3. Deployment Notifications

Set up notifications for:
- Successful deployments
- Failed deployments
- Build errors

### 4. Monitoring

After deployment, monitor:
- Application logs
- Error rates
- Response times
- Resource usage

### 5. Rollback Strategy

Always have a rollback plan:
- Keep previous versions accessible
- Document rollback procedures
- Test rollback process regularly

---

## Post-Deployment Checklist

After deploying to production:

- [ ] Verify health check endpoint responds
- [ ] Test user login functionality
- [ ] Verify API endpoints work correctly
- [ ] Check CORS configuration
- [ ] Test data persistence
- [ ] Verify environment variables are set correctly
- [ ] Check application logs for errors
- [ ] Test frontend loads correctly
- [ ] Verify session management works
- [ ] Test all major user flows

---

## Maintenance Schedule

### Daily
- Check application logs for errors
- Monitor resource usage

### Weekly
- Review and clear old logs
- Check for security updates
- Review error reports

### Monthly
- Update dependencies
- Review and optimize performance
- Backup data
- Review and update documentation

---

## Additional Resources

### Hosting Platform Documentation
- **Render**: https://render.com/docs
- **Railway**: https://docs.railway.app
- **Vercel**: https://vercel.com/docs
- **Heroku**: https://devcenter.heroku.com

### Node.js Deployment Guides
- **Node.js Production Best Practices**: https://nodejs.org/en/docs/guides/nodejs-docker-webapp/
- **Express Production Best Practices**: https://expressjs.com/en/advanced/best-practice-performance.html

### Security Resources
- **OWASP Top 10**: https://owasp.org/www-project-top-ten/
- **Node.js Security Best Practices**: https://nodejs.org/en/docs/guides/security/

---

**Last Updated**: 2026-01-31
