# Raspberry Pi 社内サーバー構築ガイド

## 1. ハードウェア構成

### 推奨構成（総額 ¥20,000以下）
- **Raspberry Pi 4 Model B 8GB**: ¥12,000
- **microSD カード 128GB**: ¥2,000
- **公式ケース + 電源**: ¥3,000
- **LANケーブル**: ¥500
- **（オプション）外付けSSD**: ¥5,000

### 性能目安
- **同時接続**: 10-15名まで対応可能
- **レスポンス**: 社内LAN環境で高速
- **稼働率**: 99%以上（適切な運用時）

## 2. OS セットアップ

### Ubuntu Server インストール
```bash
# Raspberry Pi Imager使用
# 1. Ubuntu Server 22.04 LTS を選択
# 2. SSH有効化、ユーザー作成
# 3. WiFi設定（必要に応じて）

# 初回ログイン後
sudo apt update && sudo apt upgrade -y
sudo apt install curl wget git -y
```

### Node.js インストール
```bash
# Node.js 18 LTS インストール
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# バージョン確認
node --version
npm --version
```

### PostgreSQL インストール
```bash
# PostgreSQL インストール
sudo apt install postgresql postgresql-contrib -y

# PostgreSQL 設定
sudo -u postgres psql
CREATE DATABASE certifications;
CREATE USER certapp WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE certifications TO certapp;
\q

# 外部接続許可設定
sudo nano /etc/postgresql/14/main/postgresql.conf
# listen_addresses = '*' に変更

sudo nano /etc/postgresql/14/main/pg_hba.conf
# 以下を追加
# host    all             all             192.168.1.0/24          md5

sudo systemctl restart postgresql
```

## 3. アプリケーション設定

### プロジェクトデプロイ
```bash
# アプリケーション用ディレクトリ作成
sudo mkdir -p /opt/team-cert-management
sudo chown $USER:$USER /opt/team-cert-management
cd /opt/team-cert-management

# Gitクローン
git clone https://github.com/your-org/team-cert-management.git .

# 依存関係インストール
npm ci --production

# ビルド
npm run build
```

### 環境変数設定
```bash
# .env.production 作成
cat > .env.production << EOF
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL=postgresql://certapp:your_secure_password@localhost:5432/certifications

# Security
SESSION_SECRET=$(openssl rand -base64 32)
JWT_SECRET=$(openssl rand -base64 32)

# Entra ID (オプション)
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret
AZURE_TENANT_ID=your-tenant-id
AZURE_REDIRECT_URI=http://your-pi-ip:3000/auth/callback
EOF
```

### PM2 プロセス管理
```bash
# PM2 インストール
sudo npm install -g pm2

# アプリケーション起動
pm2 start dist/app.js --name team-cert-management

# 自動起動設定
pm2 startup
pm2 save

# ログ確認
pm2 logs team-cert-management
```

## 4. Nginx リバースプロキシ設定

### Nginx インストール・設定
```bash
# Nginx インストール
sudo apt install nginx -y

# 設定ファイル作成
sudo nano /etc/nginx/sites-available/team-cert-management

# 以下の内容を記述
server {
    listen 80;
    server_name your-pi-ip;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# サイト有効化
sudo ln -s /etc/nginx/sites-available/team-cert-management /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

### SSL証明書設定（Let's Encrypt）
```bash
# Certbot インストール
sudo apt install certbot python3-certbot-nginx -y

# ドメイン取得後（例: team-cert.your-domain.com）
sudo certbot --nginx -d team-cert.your-domain.com

# 自動更新設定
sudo crontab -e
# 以下を追加
0 12 * * * /usr/bin/certbot renew --quiet
```

## 5. セキュリティ設定

### ファイアウォール設定
```bash
# UFW インストール・設定
sudo apt install ufw -y

# デフォルトポリシー
sudo ufw default deny incoming
sudo ufw default allow outgoing

# 必要なポート開放
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# 社内ネットワークからのアクセスのみ許可
sudo ufw allow from 192.168.1.0/24 to any port 22
sudo ufw allow from 192.168.1.0/24 to any port 80
sudo ufw allow from 192.168.1.0/24 to any port 443

# ファイアウォール有効化
sudo ufw enable
```

### 自動セキュリティ更新
```bash
# unattended-upgrades インストール
sudo apt install unattended-upgrades -y

# 設定
sudo dpkg-reconfigure -plow unattended-upgrades

# 設定ファイル編集
sudo nano /etc/apt/apt.conf.d/50unattended-upgrades
# セキュリティ更新のみ自動適用するよう設定
```

## 6. バックアップ設定

### 自動バックアップスクリプト
```bash
# バックアップスクリプト作成
sudo nano /opt/backup-cert-management.sh

#!/bin/bash
BACKUP_DIR="/opt/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# ディレクトリ作成
mkdir -p $BACKUP_DIR

# データベースバックアップ
sudo -u postgres pg_dump certifications > $BACKUP_DIR/db_backup_$DATE.sql

# アプリケーションファイルバックアップ
tar -czf $BACKUP_DIR/app_backup_$DATE.tar.gz -C /opt/team-cert-management .

# 古いバックアップ削除（30日以上）
find $BACKUP_DIR -name "*.sql" -mtime +30 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete

echo "Backup completed: $DATE"

# 実行権限付与
sudo chmod +x /opt/backup-cert-management.sh

# Cron設定（毎日午前2時）
sudo crontab -e
0 2 * * * /opt/backup-cert-management.sh >> /var/log/backup.log 2>&1
```

### 外部バックアップ（Google Drive）
```bash
# rclone インストール
curl https://rclone.org/install.sh | sudo bash

# Google Drive設定
rclone config

# バックアップスクリプトに追加
# Google Driveへのアップロード
rclone copy $BACKUP_DIR gdrive:team-cert-backups/
```

## 7. 監視・メンテナンス

### システム監視スクリプト
```bash
# 監視スクリプト作成
nano /opt/monitor.sh

#!/bin/bash
# CPU使用率チェック
CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | awk -F'%' '{print $1}')
if (( $(echo "$CPU_USAGE > 80" | bc -l) )); then
    echo "High CPU usage: $CPU_USAGE%" | mail -s "Pi Alert" admin@your-domain.com
fi

# メモリ使用率チェック
MEM_USAGE=$(free | grep Mem | awk '{printf("%.1f"), $3/$2 * 100.0}')
if (( $(echo "$MEM_USAGE > 80" | bc -l) )); then
    echo "High memory usage: $MEM_USAGE%" | mail -s "Pi Alert" admin@your-domain.com
fi

# ディスク使用率チェック
DISK_USAGE=$(df -h / | awk 'NR==2{print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
    echo "High disk usage: $DISK_USAGE%" | mail -s "Pi Alert" admin@your-domain.com
fi

# アプリケーション稼働チェック
if ! pm2 list | grep -q "team-cert-management.*online"; then
    echo "Application is down!" | mail -s "Pi Alert" admin@your-domain.com
    pm2 restart team-cert-management
fi
```

### 定期メンテナンス
```bash
# 月次メンテナンススクリプト
nano /opt/monthly-maintenance.sh

#!/bin/bash
# システム更新
sudo apt update && sudo apt upgrade -y

# ログローテーション
sudo logrotate -f /etc/logrotate.conf

# PM2ログクリア
pm2 flush

# 不要ファイル削除
sudo apt autoremove -y
sudo apt autoclean

# 再起動（必要に応じて）
# sudo reboot

# Cron設定（毎月1日午前3時）
0 3 1 * * /opt/monthly-maintenance.sh >> /var/log/maintenance.log 2>&1
```

## 8. 運用コスト

### 電気代計算
- **消費電力**: 約15W（高負荷時20W）
- **月間電気代**: 約¥300-400
- **年間電気代**: 約¥3,600-4,800

### 総運用コスト（年間）
- **電気代**: ¥4,000
- **インターネット**: ¥0（既存回線利用）
- **ドメイン**: ¥1,000（オプション）
- **合計**: ¥5,000/年

### 初期費用回収
- **Azure構成**: ¥6,100/月 × 12ヶ月 = ¥73,200/年
- **Pi構成**: 初期¥20,000 + 運用¥5,000 = ¥25,000/年
- **年間節約**: ¥48,200

**3-4ヶ月で初期費用回収、その後は大幅コスト削減！**

## 9. トラブルシューティング

### よくある問題と対処法

#### アプリケーションが起動しない
```bash
# ログ確認
pm2 logs team-cert-management

# 手動起動テスト
cd /opt/team-cert-management
npm start

# ポート確認
sudo netstat -tlnp | grep :3000
```

#### データベース接続エラー
```bash
# PostgreSQL状態確認
sudo systemctl status postgresql

# 接続テスト
psql -h localhost -U certapp -d certifications

# ログ確認
sudo tail -f /var/log/postgresql/postgresql-14-main.log
```

#### メモリ不足
```bash
# スワップファイル作成
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# 永続化
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

この構成により、**月額300円程度**で安定したチーム資格管理システムを社内運用できます！