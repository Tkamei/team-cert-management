# GitHub Pages + JSONファイル構成 移行ガイド

## 1. 移行方針

### 構成概要
- **フロントエンド**: GitHub Pages（静的サイト）
- **データストレージ**: JSONファイル（現在のまま）
- **データ更新**: GitHub API経由でJSONファイル更新
- **認証**: GitHub OAuth（シンプル）
- **コスト**: 完全無料

### メリット
- **完全無料**: GitHub無料アカウントで十分
- **既存コード活用**: 大部分のコードをそのまま使用
- **シンプル**: PostgreSQL不要、複雑な設定なし
- **インターネットアクセス**: 世界中からアクセス可能
- **バージョン管理**: データ変更履歴が自動で残る

## 2. アーキテクチャ設計

### データフロー
```
ユーザー → GitHub Pages → GitHub API → JSONファイル更新 → Git Commit
```

### ファイル構成
```
team-cert-management/
├── docs/                    # GitHub Pages用
│   ├── index.html
│   ├── app.js
│   ├── style.css
│   └── assets/
├── data/                    # JSONデータファイル
│   ├── users.json
│   ├── certifications.json
│   ├── achievements.json
│   ├── study_plans.json
│   └── notifications.json
├── api/                     # GitHub API操作用
│   └── github-storage.js
└── .github/
    └── workflows/
        └── deploy.yml       # 自動デプロイ
```

## 3. 必要な作業

### Phase 1: リポジトリ準備（30分）
1. GitHubリポジトリ作成
2. 既存コードのアップロード
3. GitHub Pages設定

### Phase 2: コード改修（2-3時間）
1. GitHub API連携コード作成
2. 認証システム簡素化
3. 静的サイト対応

### Phase 3: デプロイ設定（30分）
1. GitHub Actions設定
2. 環境変数設定
3. ドメイン設定（オプション）

### Phase 4: テスト・調整（1時間）
1. 動作確認
2. データ更新テスト
3. 権限設定確認

**総作業時間: 4-5時間**