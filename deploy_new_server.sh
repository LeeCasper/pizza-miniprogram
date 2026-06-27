#!/bin/bash
set -e
LOG="/root/deploy.log"
exec > >(tee -a "$LOG") 2>&1
echo "=== Deploy started at $(date) ==="

# 1. Clone repo
echo "[1/8] Cloning repo..."
if [ ! -d /opt/pizza-server ]; then
  cd /opt && git clone https://github.com/LeeCasper/pizza-miniprogram.git pizza-server
else
  cd /opt/pizza-server && git pull origin master
fi

# 2. Setup MySQL
echo "[2/8] Setting up database..."
mysql -u root -p'licongLee2003...' -e "CREATE DATABASE IF NOT EXISTS pizza CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null || true
mysql -u root -p'licongLee2003...' -e "CREATE USER 'pizza'@'localhost' IDENTIFIED BY 'pizza2024!'; GRANT ALL PRIVILEGES ON pizza.* TO 'pizza'@'localhost'; FLUSH PRIVILEGES;" 2>/dev/null || true
echo "DB OK"

# 3. Create .env
echo "[3/8] Creating .env..."
cat > /opt/pizza-server/pizza-server/.env << 'ENVEOF'
# Server
PORT=3000
NODE_ENV=production

# Database
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=pizza
DB_PASSWORD=pizza2024!
DB_NAME=pizza

# JWT
JWT_SECRET=pizza-prod-jwt-9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d

# WeChat Mini Program
WX_APPID=wx06b8f02feceac089
WX_SECRET=your-wx-secret-here

# WeChat Pay v3
WX_MCH_ID=
WX_PAY_API_V3_KEY=
WX_PAY_CERT_SERIAL_NO=
WX_PAY_PRIVATE_KEY_PATH=./certs/apiclient_key.pem
WX_PAY_PLATFORM_CERT_PATH=./certs/platform_cert.pem
WX_PAY_NOTIFY_URL=https://pizza.artaides.com/api/v1/pay/notify
WX_PAY_REFUND_NOTIFY_URL=https://pizza.artaides.com/api/v1/pay/refund-notify

# Admin Session
SESSION_SECRET=pizza-prod-session-1a2b3c4d5e6f7g8h9i0j

# Upload
UPLOAD_DIR=uploads
MAX_FILE_SIZE=5242880

# Cloud Printer
PRINTER_ENABLED=false
PRINTER_APPID=
PRINTER_APPSECRET=
PRINTER_SN=
PRINTER_API_BASE=https://www.spyun.net.cn
PRINTER_COPIES=1
ENVEOF
echo ".env created"

# 4. Create uploads dir
mkdir -p /opt/pizza-server/pizza-server/uploads
mkdir -p /opt/pizza-server/pizza-server/certs

# 5. Install npm deps
echo "[4/8] Installing npm dependencies..."
cd /opt/pizza-server/pizza-server && npm install --omit=dev 2>&1 | tail -3
echo "npm install OK"

# 6. Run DB migrations
echo "[5/8] Running migrations..."
cd /opt/pizza-server
for f in pizza-server/db/migrate_*.sql; do
  mysql -u pizza -ppizza2024! pizza < "$f" 2>&1 | grep -v "Duplicate column\|Duplicate key\|Warning" || true
done
echo "Migrations OK"

# 7. Create log dir
mkdir -p /var/log/pizza

# 8. Start PM2
echo "[6/8] Starting PM2..."
cd /opt/pizza-server/pizza-server
pm2 delete pizza-server 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root 2>&1 | grep -v '\[PM2\]' || true
echo "PM2 OK"

# 9. Verify
echo "[8/8] Verify..."
sleep 2
curl -s http://localhost:3000/health
echo ""
echo "=== Deploy complete at $(date) ==="
