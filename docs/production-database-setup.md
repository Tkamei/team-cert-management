# 本番環境データベース設定

## 1. Azure Database for PostgreSQL

### 推奨構成
- **サービス層**: Basic（5名チームには十分）
- **コンピューティング**: 1 vCore
- **ストレージ**: 32GB（自動拡張有効）
- **バックアップ**: 7日間保持

### セキュリティ設定
```bash
# ファイアウォール設定（App Serviceからのアクセスのみ許可）
az postgres server firewall-rule create \
  --resource-group myResourceGroup \
  --server-name team-cert-db \
  --name AllowAppService \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0

# SSL接続強制
az postgres server update \
  --resource-group myResourceGroup \
  --name team-cert-db \
  --ssl-enforcement Enabled
```

## 2. 接続文字列設定

### App Service環境変数
```bash
DATABASE_URL=postgresql://username:password@team-cert-db.postgres.database.azure.com:5432/certifications?ssl=true&sslmode=require
```

## 3. データ移行スクリプト

### JSONからPostgreSQLへの移行
```typescript
// scripts/migrate-to-postgres.ts
import { Pool } from 'pg';
import * as fs from 'fs';

async function migrateData() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  // 既存のJSONデータを読み込み
  const users = JSON.parse(fs.readFileSync('data/users.json', 'utf8'));
  const certifications = JSON.parse(fs.readFileSync('data/certifications.json', 'utf8'));
  const achievements = JSON.parse(fs.readFileSync('data/achievements.json', 'utf8'));
  const studyPlans = JSON.parse(fs.readFileSync('data/study_plans.json', 'utf8'));

  // データベースに挿入
  for (const user of users.users) {
    await pool.query(
      'INSERT INTO users (id, name, email, role, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING',
      [user.id, user.name, user.email, user.role, user.createdAt, user.updatedAt]
    );
  }

  // 他のテーブルも同様に移行...
  
  await pool.end();
}
```