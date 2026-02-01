# API動作確認スクリプト

Write-Host "=== チーム資格管理システム API テスト ===" -ForegroundColor Green

# 1. ヘルスチェック
Write-Host "`n1. ヘルスチェック" -ForegroundColor Yellow
$health = Invoke-RestMethod -Uri "http://localhost:3000/health" -Method Get
$health | ConvertTo-Json

# 2. ログイン
Write-Host "`n2. ログイン" -ForegroundColor Yellow
$loginBody = @{
    email = "admin@demo.com"
    password = "admin123"
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/auth/login" -Method Post -Body $loginBody -ContentType "application/json" -SessionVariable session
    Write-Host "ログイン成功！" -ForegroundColor Green
    $sessionId = $loginResponse.data.sessionId
    Write-Host "SessionID: $sessionId"
    
    # 3. 資格一覧取得
    Write-Host "`n3. 資格一覧取得" -ForegroundColor Yellow
    $headers = @{
        "Authorization" = "Bearer $sessionId"
    }
    $certifications = Invoke-RestMethod -Uri "http://localhost:3000/api/certifications" -Method Get -Headers $headers
    Write-Host "資格数: $($certifications.data.certifications.Count)" -ForegroundColor Green
    $certifications.data.certifications | Select-Object name, issuer, category | Format-Table
    
} catch {
    Write-Host "エラー: $_" -ForegroundColor Red
}

Write-Host "`n=== テスト完了 ===" -ForegroundColor Green