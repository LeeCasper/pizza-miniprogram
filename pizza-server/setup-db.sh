#!/bin/bash
# ===========================================
# 王姐手工披萨 — 数据库初始化脚本
# 用法: MYSQL_PASS=xxx ./setup-db.sh
# ===========================================
set -e

MYSQL_USER="${MYSQL_USER:-root}"

if [ -z "$MYSQL_PASS" ]; then
    echo "请设置 MYSQL_PASS 环境变量:"
    echo "  MYSQL_PASS=yourpassword ./setup-db.sh"
    exit 1
fi

echo "创建 pizza 数据库..."
mysql -u "$MYSQL_USER" -p"$MYSQL_PASS" -e "CREATE DATABASE IF NOT EXISTS pizza CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

echo "导入 schema.sql..."
mysql -u "$MYSQL_USER" -p"$MYSQL_PASS" pizza < db/schema.sql

echo "导入 seed.sql..."
mysql -u "$MYSQL_USER" -p"$MYSQL_PASS" pizza < db/seed.sql

echo "验证表结构..."
mysql -u "$MYSQL_USER" -p"$MYSQL_PASS" pizza -e "SHOW TABLES;"

echo ""
echo "✅ 数据库初始化完成"
