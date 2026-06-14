#!/bin/bash
# ===========================================
# 王姐手工披萨 — 一键部署脚本
# 用法: chmod +x deploy.sh && ./deploy.sh
# ===========================================
set -e

APP_DIR="/opt/pizza-server"
NODE_ENV="production"
MYSQL_USER="root"

echo "========================================="
echo "  王姐手工披萨 — 部署脚本"
echo "========================================="

# 1. 拉取最新代码
echo ""
echo "[1/6] 拉取最新代码..."
if [ -d "$APP_DIR/.git" ]; then
    cd "$APP_DIR" && git pull origin master
else
    echo "请先将代码克隆到 $APP_DIR:"
    echo "  git clone <repo-url> $APP_DIR"
    exit 1
fi

# 2. 安装依赖
echo ""
echo "[2/6] 安装依赖..."
cd "$APP_DIR"
npm install --production

# 3. 初始化数据库（如果尚未初始化）
echo ""
echo "[3/6] 检查数据库..."
DB_EXISTS=$(mysql -u "$MYSQL_USER" -p"$MYSQL_PASS" -sN -e "SELECT 1 FROM information_schema.schemata WHERE schema_name='pizza';" 2>/dev/null || echo "0")
if [ "$DB_EXISTS" != "1" ]; then
    echo "  创建数据库 & 导入 Schema..."
    mysql -u "$MYSQL_USER" -p"$MYSQL_PASS" -e "CREATE DATABASE IF NOT EXISTS pizza CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    mysql -u "$MYSQL_USER" -p"$MYSQL_PASS" pizza < db/schema.sql
    mysql -u "$MYSQL_USER" -p"$MYSQL_PASS" pizza < db/seed.sql
    echo "  数据库初始化完成 ✅"
else
    echo "  数据库已存在，跳过初始化 ✅"
fi

# 4. 复制 .env（如果不存在）
echo ""
echo "[4/6] 检查配置文件..."
if [ ! -f ".env" ]; then
    if [ -f ".env.production.example" ]; then
        cp .env.production.example .env
        echo "  ⚠️  已创建 .env，请编辑填入真实配置后重新运行"
        echo "     vim $APP_DIR/.env"
        exit 1
    fi
else
    echo "  .env 已存在 ✅"
fi

# 5. 创建日志目录
echo ""
echo "[5/6] 创建日志目录..."
sudo mkdir -p /var/log/pizza
sudo chown -R $USER:$USER /var/log/pizza

# 6. 启动/重启 PM2
echo ""
echo "[6/6] 启动服务..."
if command -v pm2 &>/dev/null; then
    cd "$APP_DIR"
    if pm2 list 2>/dev/null | grep -q "pizza-server"; then
        pm2 restart pizza-server
        echo "PM2 已重启 ✅"
    else
        pm2 start ecosystem.config.js
        pm2 save
        echo "PM2 已启动 ✅"
    fi
else
    echo "⚠️  PM2 未安装，使用 node 直接启动"
    echo "   安装 PM2: npm i -g pm2"
    node src/app.js &
fi

echo ""
echo "========================================="
echo "  部署完成!"
echo "  检查状态: pm2 status"
echo "  查看日志: pm2 logs pizza-server"
echo "========================================="
