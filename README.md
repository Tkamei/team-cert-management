# チーム資格管理システム（デモ版）

システムエンジニアチームのメンバーが取得する資格の管理、進捗追跡、履歴管理を行うWebアプリケーションです。

## 🌟 特徴

- **シンプル**: JSONファイルベースのデータストレージ
- **セキュア**: セッションベースの認証システム
- **モダン**: React.js + Node.js/Express.js
- **デプロイ可能**: GitHub Actions対応、無料ホスティング対応

## 🚀 クイックスタート

### 前提条件

- Node.js 16.x 以上
- npm または yarn

### ローカル開発環境のセットアップ

1. **リポジトリのクローン**

```bash
git clone https://github.com/YOUR_USERNAME/team-cert-management.git
cd team-cert-management
```

2. **依存関係のインストール**

```bash
# バックエンドの依存関係
npm install

# フロントエンドの依存関係
cd client
npm install
cd ..
```

3. **環境変数の設定**

`.env.example` をコピーして `.env` を作成：

```bash
cp .env.example .env
```

`.env` ファイルを編集して必要な値を設定：

```env
PORT=3000
NODE_ENV=development
SESSION_SECRET=your_secure_session_secret_here
DATA_DIR=./data
CORS_ORIGIN=http://localhost:3000,http://localhost:5173
```

4. **開発サーバーの起動**

```bash
# バックエンドサーバー（ターミナル1）
npm run dev:server

# フロントエンドサーバー（ターミナル2）
npm run dev:client
```

アプリケーションは以下のURLでアクセス可能：
- フロントエンド: http://localhost:5173
- バックエンドAPI: http://localhost:3000

### 初回ログイン

デモモードが有効な場合、以下の認証情報でログインできます：
- メールアドレス: `admin@demo.com`
- パスワード: `admin123`

## 📖 環境変数

| 変数名 | 説明 | デフォルト値 | 必須 |
|--------|------|-------------|------|
| `PORT` | サーバーポート番号 | `3000` | いいえ |
| `NODE_ENV` | 実行環境 (`development`, `production`) | `development` | いいえ |
| `SESSION_SECRET` | セッション暗号化キー | - | はい（本番環境） |
| `DATA_DIR` | JSONデータファイルの保存ディレクトリ | `./data` | いいえ |
| `CORS_ORIGIN` | CORS許可オリジン（カンマ区切り） | `http://localhost:3000` | いいえ |
| `FRONTEND_BUILD_PATH` | フロントエンドビルドディレクトリ | `./client/build` | いいえ（本番環境のみ） |
| `LOG_LEVEL` | ログレベル | `info` | いいえ |
| `DEMO_MODE` | デモモード有効化 | `true` | いいえ |

## 🏗️ アーキテクチャ

### システム構成

```
┌─────────────────┐
│  React Frontend │
│  (TypeScript)   │
└────────┬────────┘
         │ HTTP/REST API
         ↓
┌─────────────────┐
│ Express Backend │
│  (Node.js)      │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  JSON Storage   │
│  (File System)  │
└─────────────────┘
```

### ディレクトリ構造

```
team-cert-management/
├── client/                 # React フロントエンド
│   ├── src/
│   │   ├── components/    # UIコンポーネント
│   │   ├── pages/         # ページコンポーネント
│   │   ├── services/      # API通信
│   │   ├── hooks/         # カスタムフック
│   │   └── types/         # TypeScript型定義
│   ├── public/
│   └── package.json
├── src/                   # Express バックエンド
│   ├── routes/           # APIルート
│   ├── services/         # ビジネスロジック
│   ├── middleware/       # ミドルウェア
│   ├── data/            # データ管理
│   └── types/           # TypeScript型定義
├── data/                 # JSONデータファイル（gitignore）
│   ├── users.json
│   ├── certifications.json
│   ├── study_plans.json
│   ├── achievements.json
│   └── notifications.json
├── .github/
│   └── workflows/       # GitHub Actions
├── .env.example         # 環境変数テンプレート
├── package.json         # ルートpackage.json
└── README.md
```

## 📋 主な機能

### ユーザー管理
- ユーザーアカウントの作成・編集・削除
- 権限管理（管理者/メンバー）
- セッションベース認証

### 資格情報管理
- 資格の登録・編集・削除
- カテゴリ別分類（クラウド、セキュリティ、プログラミング等）
- 検索・フィルタリング機能

### 学習計画管理
- 資格取得計画の作成・管理
- 進捗追跡（0-100%）
- 目標日設定とリマインダー

### 取得履歴管理
- 取得済み資格の記録
- 有効期限管理
- 更新通知

### レポート機能
- ダッシュボード統計
- チーム全体の進捗状況
- 個人別レポート

## 🚀 デプロイメント

詳細なデプロイメント手順は [DEPLOYMENT.md](DEPLOYMENT.md) を参照してください。

### 本番環境ビルド

```bash
# フロントエンドのビルド
cd client
npm run build
cd ..

# 本番環境で起動
NODE_ENV=production npm start
```

### 推奨ホスティングプラットフォーム

- **Render**: 無料プラン対応、自動デプロイ
- **Railway**: 無料プラン対応、簡単設定
- **Heroku**: 有料プラン推奨
- **Vercel**: フロントエンド向け（バックエンドはServerless Functions）

## 🧪 テスト

```bash
# 全テストの実行
npm test

# カバレッジレポート
npm run test:coverage
```

## 🤝 コントリビューション

1. このリポジトリをフォーク
2. フィーチャーブランチを作成 (`git checkout -b feature/AmazingFeature`)
3. 変更をコミット (`git commit -m 'Add some AmazingFeature'`)
4. ブランチにプッシュ (`git push origin feature/AmazingFeature`)
5. プルリクエストを作成

## 📄 ライセンス

MIT License

## 🆘 サポート

問題や質問がある場合は、[Issues](https://github.com/YOUR_USERNAME/team-cert-management/issues) を作成してください。

## 📊 技術スタック

- **フロントエンド**: React.js 18, TypeScript, Vite
- **バックエンド**: Node.js, Express.js, TypeScript
- **データストレージ**: JSON ファイル
- **認証**: セッションベース（express-session）
- **スタイリング**: CSS Modules
- **テスト**: Jest, fast-check（プロパティベーステスト）

---

**チーム向けの軽量資格管理システム** 🎓