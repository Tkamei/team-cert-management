# チーム資格管理システム API テストスクリプト

# ベースURL
$baseUrl = "http://localhost:3000"

Write-Host "=== チーム資格管理システム API テスト ===" -ForegroundColor Green

# 1. ヘルスチェック
Write-Host "`n1. ヘルスチェック" -ForegroundColor Yellow
$health = Invoke-RestMethod -Uri "$baseUrl/health" -Method Get
$health | ConvertTo-Json

# 2. ログイン（管理者）
Write-Host "`n2. 管理者でログイン" -ForegroundColor Yellow
$loginBody = @{
    email = "admin@demo.com"
    password = "admin123"
} | ConvertTo-Json

$loginResponse = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method Post -Body $loginBody -ContentType "application/json" -SessionVariable session
$sessionId = $loginResponse.data.sessionId
Write-Host "ログイン成功！SessionID: $sessionId" -ForegroundColor Green
$loginResponse.data.user | ConvertTo-Json

# 3. 資格情報一覧を取得
Write-Host "`n3. 資格情報一覧を取得" -ForegroundColor Yellow
$headers = @{
    "Authorization" = "Bearer $sessionId"
}
$certifications = Invoke-RestMethod -Uri "$baseUrl/api/certifications" -Method Get -Headers $headers
Write-Host "資格数: $($certifications.data.certifications.Count)" -ForegroundColor Green
$certifications.data.certifications | Select-Object name, issuer, category | Format-Table

# 4. ユーザー一覧を取得
Write-Host "`n4. ユーザー一覧を取得" -ForegroundColor Yellow
$users = Invoke-RestMethod -Uri "$baseUrl/api/users" -Method Get -Headers $headers
Write-Host "ユーザー数: $($users.data.users.Count)" -ForegroundColor Green
$users.data.users | Select-Object name, email, role | Format-Table

# 5. 自分の学習計画を取得
Write-Host "`n5. 自分の学習計画を取得" -ForegroundColor Yellow
$myPlans = Invoke-RestMethod -Uri "$baseUrl/api/study-plans/my" -Method Get -Headers $headers
Write-Host "学習計画数: $($myPlans.data.plans.Count)" -ForegroundColor Green
if ($myPlans.data.plans.Count -gt 0) {
    $myPlans.data.plans | Select-Object @{N='進捗';E={$_.progress}}, status | Format-Table
}

# 6. 自分の取得資格を取得
Write-Host "`n6. 自分の取得資格を取得" -ForegroundColor Yellow
$myAchievements = Invoke-RestMethod -Uri "$baseUrl/api/achievements/my" -Method Get -Headers $headers
Write-Host "取得資格数: $($myAchievements.data.achievements.Count)" -ForegroundColor Green
if ($myAchievements.data.achievements.Count -gt 0) {
    $myAchievements.data.achievements | Select-Object achievedDate, isActive | Format-Table
}

# 7. 通知を取得
Write-Host "`n7. 通知を取得" -ForegroundColor Yellow
$notifications = Invoke-RestMethod -Uri "$baseUrl/api/notifications" -Method Get -Headers $headers
Write-Host "通知数: $($notifications.data.notifications.Count)" -ForegroundColor Green
if ($notifications.data.notifications.Count -gt 0) {
    $notifications.data.notifications | Select-Object title, type, isRead | Format-Table
}

Write-Host "`n=== テスト完了 ===" -ForegroundColor Green
Write-Host "`nSessionID: $sessionId" -ForegroundColor Cyan
Write-Host "このSessionIDを使って、他のAPIエンドポイントにアクセスできます。" -ForegroundColor Cyan
