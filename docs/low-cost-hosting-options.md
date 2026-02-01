# 低コスト運用ガイド

## 1. 超低コスト案（月額0円〜500円）

### 案1: GitHub Pages + Supabase（推奨）
**月額コスト: 0円（無料枠内）**

#### 構成
- **フロントエンド**: GitHub Pages（静的サイト）
- **バックエンド**: Supabase（PostgreSQL + Auth + API）
- **認証**: Supabase Auth（Entra ID連携可能）
- **ストレージ**: Supabase（500MB無料）

#### メリット
- 完全無料で運用可能
- PostgreSQL使用可能
- リアルタイム機能付き
- 自動バックアップ
- SSL証明書自動

#### 制限
- 月間50,000 API呼び出し
- 500MB ストレージ
- 2GB 転送量

### 案2: Vercel + PlanetScale
**月額コスト: 0円（無料枠内）**

#### 構成
- **フロントエンド**: Vercel（Next.js）
- **バックエンド**: Vercel Functions
- **データベース**: PlanetScale（MySQL）
- **認証**: NextAuth.js（Entra ID対応）

#### メリット
- サーバーレスで高速
- 自動スケーリング
- Git連携デプロイ
- 1GB データベース無料

## 2. 格安VPS案（月額500円〜1,000円）

### 案1: さくらVPS（月額590円）
**構成**: 1GB RAM, 25GB SSD, 1 vCPU

```bash
# 初期セットアップ
sudo apt update && sudo apt upgrade -y
sudo apt install nodejs npm nginx postgresql -y

# Node.js 18 インストール
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# PostgreSQL設定
sudo -u postgres createdb certifications
sudo -u postgres createuser --interactive
```

### 案2: ConoHa VPS（月額682円）
**構成**: 1GB RAM, 100GB SSD, 1 vCPU

### 案3: Vultr（月額$3.50 ≈ 500円）
**構成**: 1GB RAM, 25GB SSD, 1 vCPU

## 3. 社内サーバー案（初期費用のみ）

### 推奨ハードウェア
- **Raspberry Pi 4 8GB**: ¥12,000
- **microSD 128GB**: ¥2,000
- **ケース・電源**: ¥3,000
- **合計**: ¥17,000

### セットアップ
```bash
# Ubuntu Server インストール後
sudo apt update && sudo apt upgrade -y
sudo apt install nodejs npm nginx postgresql -y

# PM2でプロセス管理
npm install -g pm2
pm2 start dist/app.js --name team-cert-management
pm2 startup
pm2 save
```

### 電気代
- 消費電力: 約15W
- 月額電気代: 約¥300（24時間稼働）

## 4. 無料ホスティング最大活用案

### Railway（推奨）
**月額コスト: 0円〜$5**

```dockerfile
# Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

#### 無料枠
- 512MB RAM
- $5分の実行時間
- PostgreSQL付き

### Render
**月額コスト: 0円**

#### 無料枠
- 512MB RAM
- 750時間/月
- PostgreSQL 1GB

### Fly.io
**月額コスト: 0円**

#### 無料枠
- 256MB RAM × 3インスタンス
- 3GB ストレージ

## 5. 現在のJSONファイル運用継続案

### GitHub + Netlify
**月額コスト: 0円**

#### 構成変更
```typescript
// GitHub APIを使ったデータ永続化
class GitHubStorage {
  private owner = 'your-org';
  private repo = 'team-cert-data';
  private token = process.env.GITHUB_TOKEN;

  async saveData(filename: string, data: any) {
    const content = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');
    
    await fetch(`https://api.github.com/repos/${this.owner}/${this.repo}/contents/data/${filename}`, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `Update ${filename}`,
        content,
        sha: await this.getFileSha(filename)
      })
    });
  }
}
```

### Netlify Functions
```typescript
// netlify/functions/api.ts
export const handler = async (event, context) => {
  // 既存のAPIロジックをそのまま使用
  return {
    statusCode: 200,
    body: JSON.stringify(result)
  };
};
```

## 6. 推奨構成比較

| 方式 | 月額コスト | 初期費用 | 管理工数 | 可用性 |
|------|-----------|----------|----------|--------|
| GitHub Pages + Supabase | ¥0 | ¥0 | 低 | 高 |
| Railway | ¥0-700 | ¥0 | 低 | 高 |
| さくらVPS | ¥590 | ¥0 | 中 | 中 |
| Raspberry Pi | ¥300 | ¥17,000 | 高 | 低 |
| Netlify + GitHub | ¥0 | ¥0 | 低 | 高 |

## 7. 最推奨: GitHub Pages + Supabase構成

### 実装手順

#### 1. Supabaseプロジェクト作成
```sql
-- Supabaseでのテーブル作成
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS (Row Level Security) 設定
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own data" ON users
  FOR SELECT USING (auth.uid()::text = id::text);
```

#### 2. フロントエンド改修
```typescript
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://your-project.supabase.co';
const supabaseKey = 'your-anon-key';

export const supabase = createClient(supabaseUrl, supabaseKey);

// 認証
export const signInWithAzure = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'azure',
    options: {
      scopes: 'email profile'
    }
  });
  return { data, error };
};
```

#### 3. GitHub Actions設定
```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
    
    - name: Install and Build
      run: |
        npm ci
        npm run build
    
    - name: Deploy to GitHub Pages
      uses: peaceiris/actions-gh-pages@v3
      with:
        github_token: ${{ secrets.GITHUB_TOKEN }}
        publish_dir: ./dist
```

### 移行作業
1. Supabaseプロジェクト作成
2. 既存JSONデータのインポート
3. フロントエンドのSupabase対応
4. GitHub Pagesデプロイ設定
5. カスタムドメイン設定（オプション）

**結果**: 完全無料で高機能なシステムが構築可能！