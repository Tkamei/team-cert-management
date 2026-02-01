# デプロイメントガイド

## 1. CI/CDパイプライン設定

### GitHub Actions設定
```yaml
# .github/workflows/deploy.yml
name: Deploy to Azure

on:
  push:
    branches: [ main ]
  pull_request:
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
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run tests
      run: npm test
    
    - name: Build application
      run: npm run build
    
    - name: Deploy to Azure App Service
      uses: azure/webapps-deploy@v2
      with:
        app-name: 'team-cert-management'
        publish-profile: ${{ secrets.AZURE_WEBAPP_PUBLISH_PROFILE }}
        package: .
```

## 2. 環境別設定

### 本番環境 (.env.production)
```bash
NODE_ENV=production
PORT=8080

# Azure Entra ID
AZURE_CLIENT_ID=your-production-client-id
AZURE_CLIENT_SECRET=your-production-client-secret
AZURE_TENANT_ID=your-tenant-id
AZURE_REDIRECT_URI=https://team-cert-management.azurewebsites.net/auth/callback

# Database
DATABASE_URL=postgresql://user:pass@team-cert-db.postgres.database.azure.com:5432/certifications?ssl=true

# Security
SESSION_SECRET=your-strong-session-secret
JWT_SECRET=your-jwt-secret
ENCRYPTION_KEY=your-encryption-key

# Azure Services
KEY_VAULT_NAME=team-cert-keyvault
STORAGE_ACCOUNT_NAME=teamcertstorage

# Monitoring
APPLICATIONINSIGHTS_CONNECTION_STRING=your-app-insights-connection-string
```

### ステージング環境 (.env.staging)
```bash
NODE_ENV=staging
PORT=8080

# 本番と同じ設定だが、別のリソースを使用
AZURE_CLIENT_ID=your-staging-client-id
DATABASE_URL=postgresql://user:pass@team-cert-db-staging.postgres.database.azure.com:5432/certifications?ssl=true
```

## 3. デプロイメント手順

### 初回デプロイ
```bash
# 1. Azureリソース作成
az group create --name team-cert-rg --location japaneast

# 2. App Service Plan作成
az appservice plan create \
  --name team-cert-plan \
  --resource-group team-cert-rg \
  --sku B1 \
  --is-linux

# 3. Web App作成
az webapp create \
  --resource-group team-cert-rg \
  --plan team-cert-plan \
  --name team-cert-management \
  --runtime "NODE|18-lts"

# 4. PostgreSQL作成
az postgres server create \
  --resource-group team-cert-rg \
  --name team-cert-db \
  --admin-user certadmin \
  --admin-password YourStrongPassword123! \
  --sku-name B_Gen5_1

# 5. データベース作成
az postgres db create \
  --resource-group team-cert-rg \
  --server-name team-cert-db \
  --name certifications

# 6. 環境変数設定
az webapp config appsettings set \
  --resource-group team-cert-rg \
  --name team-cert-management \
  --settings @appsettings.json
```

### 継続的デプロイ
```bash
# GitHub Actionsでの自動デプロイ設定
az webapp deployment github-actions add \
  --resource-group team-cert-rg \
  --name team-cert-management \
  --repo https://github.com/your-org/team-cert-management \
  --branch main \
  --login-with-github
```

## 4. 監視・アラート設定

### Application Insights設定
```bash
# Application Insights作成
az monitor app-insights component create \
  --app team-cert-insights \
  --location japaneast \
  --resource-group team-cert-rg \
  --application-type web

# Web Appに統合
az webapp config appsettings set \
  --resource-group team-cert-rg \
  --name team-cert-management \
  --settings APPLICATIONINSIGHTS_CONNECTION_STRING="your-connection-string"
```

### アラート設定
```bash
# 高CPU使用率アラート
az monitor metrics alert create \
  --name "High CPU Usage" \
  --resource-group team-cert-rg \
  --scopes /subscriptions/{subscription-id}/resourceGroups/team-cert-rg/providers/Microsoft.Web/sites/team-cert-management \
  --condition "avg Percentage CPU > 80" \
  --description "CPU usage is above 80%" \
  --evaluation-frequency 5m \
  --window-size 15m \
  --severity 2
```