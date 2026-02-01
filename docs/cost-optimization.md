# コスト最適化ガイド

## 1. 推奨Azure構成（5名チーム）

### 月額コスト見積もり（東日本リージョン）

| サービス | 構成 | 月額コスト（円） |
|---------|------|----------------|
| App Service | Basic B1 (1.75GB RAM, 1 vCore) | ¥1,800 |
| PostgreSQL | Basic (1 vCore, 32GB) | ¥3,500 |
| Application Insights | 基本監視 | ¥500 |
| Key Vault | 標準 | ¥300 |
| **合計** | | **¥6,100/月** |

### コスト削減策

#### 1. 開発/ステージング環境の最適化
```bash
# 開発環境は必要時のみ起動
az webapp stop --name team-cert-management-dev --resource-group team-cert-rg

# 自動シャットダウンスケジュール設定
az webapp config set \
  --resource-group team-cert-rg \
  --name team-cert-management-dev \
  --auto-heal-enabled true
```

#### 2. データベースの最適化
```bash
# 開発環境でのPostgreSQLスケールダウン
az postgres server update \
  --resource-group team-cert-rg \
  --name team-cert-db-dev \
  --sku-name B_Gen5_1 \
  --storage-size 32768
```

## 2. 運用コスト削減

### 自動スケーリング設定
```typescript
// 営業時間外の自動スケールダウン
const schedule = {
  // 平日 9:00-18:00 のみフルスペック
  weekdays: {
    start: '09:00',
    end: '18:00',
    instances: 1
  },
  // 夜間・週末は最小構成
  offHours: {
    instances: 0 // App Serviceを停止
  }
};
```

### リソース使用量監視
```bash
# コストアラート設定
az consumption budget create \
  --budget-name team-cert-budget \
  --amount 10000 \
  --time-grain Monthly \
  --start-date 2024-01-01 \
  --end-date 2024-12-31 \
  --resource-group team-cert-rg
```

## 3. 代替ホスティング案

### 案1: Azure Container Instances（最安）
**月額コスト: ¥2,000-3,000**
- 必要時のみ起動
- 5名チームには十分な性能
- 手動デプロイが必要

### 案2: Azure Static Web Apps + Functions
**月額コスト: ¥1,000-2,000**
- フロントエンドは静的ホスティング
- APIはAzure Functions
- サーバーレスでコスト効率的

### 案3: オンプレミス（社内サーバー）
**初期コスト: ¥50,000-100,000**
- 小型NUC等での運用
- 電気代・保守費用を考慮
- セキュリティ管理が必要

## 4. 長期運用での考慮事項

### スケーラビリティ
```typescript
// チーム拡大時の設定変更
const scalingPlan = {
  '5-10名': 'Basic B1',
  '10-20名': 'Standard S1',
  '20名以上': 'Premium P1v2'
};
```

### データ保持ポリシー
```sql
-- 古いログデータの自動削除
CREATE OR REPLACE FUNCTION cleanup_old_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM audit_logs 
  WHERE created_at < NOW() - INTERVAL '2 years';
END;
$$ LANGUAGE plpgsql;

-- 月次実行のスケジュール設定
SELECT cron.schedule('cleanup-logs', '0 0 1 * *', 'SELECT cleanup_old_logs();');
```