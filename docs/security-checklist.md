# セキュリティチェックリスト

## 1. 認証・認可

### ✅ 実装必須項目
- [ ] Entra ID統合による認証
- [ ] JWTトークンの適切な検証
- [ ] セッションタイムアウト設定（推奨: 8時間）
- [ ] 管理者権限の適切な分離
- [ ] APIエンドポイントの認証必須化

### 設定例
```typescript
// JWT設定
const jwtOptions = {
  expiresIn: '8h',
  issuer: 'team-cert-management',
  audience: process.env.AZURE_CLIENT_ID
};

// セッション設定
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true, // HTTPS必須
    httpOnly: true,
    maxAge: 8 * 60 * 60 * 1000 // 8時間
  }
}));
```

## 2. データ保護

### ✅ 暗号化
- [ ] データベース接続のSSL/TLS暗号化
- [ ] 機密データ（認定番号等）の暗号化
- [ ] Azure Key Vaultでの秘密情報管理

### 実装例
```typescript
import { DefaultAzureCredential } from '@azure/identity';
import { SecretClient } from '@azure/keyvault-secrets';

const credential = new DefaultAzureCredential();
const client = new SecretClient(
  `https://${process.env.KEY_VAULT_NAME}.vault.azure.net/`,
  credential
);

// 機密情報の取得
const dbPassword = await client.getSecret('database-password');
```

## 3. ネットワークセキュリティ

### ✅ Azure設定
- [ ] App ServiceでHTTPS強制
- [ ] カスタムドメインとSSL証明書
- [ ] IP制限（オフィスIPのみ許可）
- [ ] DDoS保護

### App Service設定
```bash
# HTTPS強制
az webapp update --resource-group myResourceGroup --name team-cert-management --https-only true

# IP制限設定
az webapp config access-restriction add \
  --resource-group myResourceGroup \
  --name team-cert-management \
  --rule-name OfficeIP \
  --action Allow \
  --ip-address 203.0.113.0/24 \
  --priority 100
```

## 4. 監査・ログ

### ✅ 実装項目
- [ ] ユーザーアクション監査ログ
- [ ] 失敗したログイン試行の記録
- [ ] データ変更履歴の保持
- [ ] Azure Monitor統合

### ログ実装例
```typescript
// 監査ログミドルウェア
app.use((req, res, next) => {
  if (req.user) {
    logger.info('User action', {
      userId: req.user.id,
      action: `${req.method} ${req.path}`,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });
  }
  next();
});
```

## 5. バックアップ・災害復旧

### ✅ 設定項目
- [ ] 自動データベースバックアップ（日次）
- [ ] アプリケーションコードのGitバックアップ
- [ ] 復旧手順書の作成
- [ ] 定期的な復旧テスト

### バックアップ設定
```bash
# PostgreSQLの自動バックアップ設定
az postgres server configuration set \
  --resource-group myResourceGroup \
  --server-name team-cert-db \
  --name backup_retention_days \
  --value 30
```