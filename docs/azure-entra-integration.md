# Azure Entra ID統合ガイド

## 1. アプリケーション登録

### Azure Portal での設定
1. Azure Portal > Entra ID > アプリの登録
2. 新しい登録を作成
3. リダイレクトURI設定: `https://your-app.azurewebsites.net/auth/callback`

### 必要な権限
- `User.Read` - ユーザー基本情報の読み取り
- `GroupMember.Read.All` - グループメンバーシップの確認（管理者権限判定用）

## 2. 環境変数設定

```bash
# Azure App Service での設定
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret
AZURE_TENANT_ID=your-tenant-id
AZURE_REDIRECT_URI=https://your-app.azurewebsites.net/auth/callback
ADMIN_GROUP_ID=your-admin-group-object-id
```

## 3. 認証フロー実装

### パッケージ追加
```bash
npm install @azure/msal-node passport passport-azure-ad
```

### 認証ミドルウェア
```typescript
import { BearerStrategy } from 'passport-azure-ad';

const options = {
  identityMetadata: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/v2.0/.well-known/openid_configuration`,
  clientID: process.env.AZURE_CLIENT_ID,
  validateIssuer: true,
  loggingLevel: 'info',
  passReqToCallback: false
};

passport.use(new BearerStrategy(options, (token, done) => {
  // トークン検証とユーザー情報取得
  return done(null, token);
}));
```

## 4. 権限管理

### 管理者判定
```typescript
async function isAdmin(userId: string): Promise<boolean> {
  // Microsoft Graph APIでグループメンバーシップを確認
  const graphClient = Client.init({
    authProvider: authProvider
  });
  
  try {
    const memberOf = await graphClient
      .users(userId)
      .memberOf()
      .get();
    
    return memberOf.some(group => 
      group.id === process.env.ADMIN_GROUP_ID
    );
  } catch (error) {
    return false;
  }
}
```