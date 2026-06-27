# 新服务器部署指南

## 环境要求

| 组件 | 版本要求 | 说明 |
|------|---------|------|
| 操作系统 | CentOS 7+ / Ubuntu 20+ / Debian 11+ | 推荐 Ubuntu 22.04 |
| Node.js | **≥ v22.13** | pnpm + Soybean Admin 要求 |
| MySQL | 8.0+ | utf8mb4 字符集 |
| Nginx | 1.18+ | 反向代理 + SSL |
| PM2 | 最新版 | Node 进程守护 |
| Git | 2.x | 拉取代码 |
| pnpm | 最新版 | Soybean Admin 构建 |
| 宝塔面板 | 可选 | 图形化管理 |

---

## 一、宝塔面板手动部署

### 1.1 宝塔安装基础环境

登录宝塔面板 → 软件商店：

1. **安装 MySQL 8.0**
   - 软件商店 → 搜索 MySQL → 安装 MySQL 8.0
   - 安装完成后 → 数据库 → 添加数据库
     - 数据库名：`pizza`
     - 用户名：`pizza`（或自定义）
     - 密码：自行设置强密码
     - 字符集：`utf8mb4`

2. **安装 Nginx**
   - 软件商店 → 搜索 Nginx → 安装（1.22+ 即可）

3. **安装 Node.js 版本管理器**
   - 软件商店 → 搜索 "Node.js 版本管理器" → 安装
   - 安装后进入设置 → 安装 Node v22.13+（如 v22.14.0 LTS）

4. **安装 PM2 管理器**（可选，方便图形化管理）
   - 软件商店 → 搜索 PM2 → 安装

### 1.2 安装 Git 并拉取代码

SSH 登录服务器，或在宝塔「终端」中执行：

```bash
# 安装 Git
yum install -y git    # CentOS
# 或
apt install -y git    # Ubuntu/Debian

# 拉取代码到 /opt
cd /opt
git clone https://github.com/你的仓库地址.git pizza-server
```

### 1.3 创建 .env 配置文件

```bash
cd /opt/pizza-server/pizza-server
cp .env.example .env   # 如果没有 .example 就新建
vim .env
```

编辑内容（**替换所有占位符**）：

```ini
# Server
PORT=3000
NODE_ENV=production

# Database（填写宝塔创建的数据库信息）
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=pizza
DB_PASSWORD=你设置的数据库密码
DB_NAME=pizza

# JWT（生成随机字符串：openssl rand -hex 32）
JWT_SECRET=替换为随机32位以上的字符串

# WeChat Mini Program
WX_APPID=wx06b8f02feceac089
WX_SECRET=你的小程序AppSecret

# WeChat Pay v3（从微信支付商户平台获取）
WX_MCH_ID=你的商户号
WX_PAY_API_V3_KEY=你的APIv3密钥
WX_PAY_CERT_SERIAL_NO=你的证书序列号
WX_PAY_PRIVATE_KEY_PATH=./certs/apiclient_key.pem
WX_PAY_PLATFORM_CERT_PATH=./certs/platform_cert.pem
WX_PAY_NOTIFY_URL=https://新域名.com/api/v1/pay/notify
WX_PAY_REFUND_NOTIFY_URL=https://新域名.com/api/v1/pay/refund-notify

# Admin Session
SESSION_SECRET=替换为随机字符串

# Upload
UPLOAD_DIR=uploads
MAX_FILE_SIZE=5242880

# Cloud Printer（可选，云打印机）
PRINTER_ENABLED=false
PRINTER_APPID=
PRINTER_APPSECRET=
PRINTER_SN=
PRINTER_API_BASE=https://www.spyun.net.cn
PRINTER_COPIES=1
```

### 1.4 放置微信支付证书

用宝塔「文件」管理或 SCP 上传到服务器：

```bash
# 在 /opt/pizza-server/pizza-server/certs/ 目录下放入两个文件：
#   1. apiclient_key.pem  — 商户 API 私钥
#   2. platform_cert.pem  — 微信支付平台证书
```

从微信支付商户平台 → API 安全 → 下载。

### 1.5 初始化数据库

```bash
cd /opt/pizza-server

# 1. 先创建数据库结构
mysql -u pizza -p pizza < pizza-server/db/schema.sql

# 2. 按顺序运行所有增量迁移
for f in pizza-server/db/migrate_*.sql; do
  echo "Running $f..."
  mysql -u pizza -p pizza < "$f" 2>&1 | grep -v "Duplicate column\|Duplicate key"
done

# 3. 插入种子数据（可选，包含系统配置默认值等）
mysql -u pizza -p pizza < pizza-server/db/seed.sql
```

### 1.6 安装依赖并启动

```bash
cd /opt/pizza-server/pizza-server
npm install --production
```

宝塔 PM2 管理器方式：
- 打开 PM2 管理器 → 添加项目
- 启动目录：`/opt/pizza-server/pizza-server`
- 启动文件：`src/app.js`
- 项目名称：`pizza-server`
- 环境变量：`NODE_ENV=production`
- 点击添加/启动

或者命令行：
```bash
npm install -g pm2
cd /opt/pizza-server/pizza-server
pm2 start ecosystem.config.js
pm2 save
pm2 startup    # 设置开机自启，按提示执行输出的命令
```

### 1.7 配置 Nginx

宝塔面板 → 网站 → 添加站点：
- 域名：填你的新域名（如 `newdomain.com`）
- 根目录：`/www/wwwroot/newdomain.com`（宝塔会自动创建）
- PHP 版本：选择「纯静态」
- 点击提交

然后点刚创建的网站 → 设置：

**① 反向代理**：
- 目标 URL：`http://127.0.0.1:3000`
- 发送域名：`$host`

**② 配置文件** — 在宝塔自动生成的基础上，追加以下内容：

```nginx
# === 在反向代理生成的 location / 后面追加 ===

# 管理后台静态资源缓存
location /admin/assets/ {
    proxy_pass http://127.0.0.1:3000;
    expires 30d;
    add_header Cache-Control "public, immutable";
}

# 上传文件目录
location /uploads/ {
    proxy_pass http://127.0.0.1:3000;
    expires 7d;
}

# 禁止访问敏感文件
location ~* (\.env|\.env\..*|\.git|node_modules|\.DS_Store|ecosystem\.config\.js)$ {
    return 404;
}
```

**③ SSL**：
- 宝塔面板 → 网站 → 设置 → SSL → Let's Encrypt
- 勾选域名 → 申请证书 → 开启「强制 HTTPS」

### 1.8 上传管理后台前端

在**本地开发机**上构建：

```powershell
# 先切到 v22+ Node
$env:PATH = "C:\Program Files\nodejs;" + $env:PATH

cd D:\Code\Pizza\soybean-admin-temp

# 确认 .env.prod 里指向新域名
# VITE_SERVICE_BASE_URL=https://新域名.com

pnpm install
pnpm build
```

构建产物在 `dist/` 目录。用宝塔「文件」上传到服务器：

```
/www/wwwroot/newdomain.com/dist/   ← 上传 dist/ 全部内容到这儿
```

**或者用 SCP**（在本地 PowerShell）：
```powershell
scp -r D:\Code\Pizza\soybean-admin-temp\dist\* root@你的服务器IP:/www/wwwroot/newdomain.com/dist/
```

### 1.9 创建上传目录

```bash
mkdir -p /www/wwwroot/newdomain.com/uploads
chmod 755 /www/wwwroot/newdomain.com/uploads
```

### 1.10 防火墙放行端口

宝塔 → 安全：
- 确保 **80**（HTTP）和 **443**（HTTPS）端口放行
- Node.js 的 3000 端口**不需要**放行（走 Nginx 反向代理）

---

## 二、命令行部署（无宝塔）

### 2.1 安装全部依赖

```bash
# Ubuntu 22.04 示例
apt update

# Node.js v22
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs

# MySQL 8.0
apt install -y mysql-server
mysql_secure_installation   # 设置 root 密码

# Nginx
apt install -y nginx

# Git
apt install -y git

# PM2
npm install -g pm2 pnpm
```

### 2.2 创建数据库

```bash
mysql -u root -p
```

```sql
CREATE DATABASE pizza CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'pizza'@'localhost' IDENTIFIED BY '强密码';
GRANT ALL PRIVILEGES ON pizza.* TO 'pizza'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 2.3 拉取代码 & 配置

```bash
cd /opt
git clone https://github.com/你的仓库地址.git pizza-server

# 创建日志目录
mkdir -p /var/log/pizza

# 配置 .env（同 1.3 节内容）
cd /opt/pizza-server/pizza-server
vim .env

# 放置微信支付证书（同 1.4 节）
mkdir -p certs
# 上传 apiclient_key.pem 和 platform_cert.pem 到 certs/
```

### 2.4 初始化数据库

```bash
cd /opt/pizza-server

# 创建表结构
mysql -u pizza -p pizza < pizza-server/db/schema.sql

# 运行全部增量迁移（会报 Duplicate column 警告，无害）
for f in pizza-server/db/migrate_*.sql; do
  mysql -u pizza -p pizza < "$f" 2>&1
done

# 种子数据（可选）
mysql -u pizza -p pizza < pizza-server/db/seed.sql
```

### 2.5 安装依赖并启动

```bash
cd /opt/pizza-server/pizza-server
npm install --production

# 用 PM2 启动
pm2 start ecosystem.config.js
pm2 save
pm2 startup    # 按提示复制执行开机自启命令
```

验证：
```bash
pm2 status          # 应显示 pizza-server online
curl http://localhost:3000/health   # 应返回 {"status":"ok"}
```

### 2.6 创建 Nginx 站点配置

```bash
vim /etc/nginx/sites-available/newdomain.com
```

```nginx
server {
    listen 80;
    server_name newdomain.com www.newdomain.com;

    root /var/www/newdomain.com;

    # 反向代理到 Node.js
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 管理后台静态资源缓存
    location /admin/assets/ {
        proxy_pass http://127.0.0.1:3000;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    location /uploads/ {
        proxy_pass http://127.0.0.1:3000;
        expires 7d;
    }

    # 禁止访问敏感文件
    location ~* (\.env|\.env\..*|\.git|node_modules|ecosystem\.config\.js)$ {
        return 404;
    }

    access_log /var/log/nginx/pizza-access.log;
    error_log /var/log/nginx/pizza-error.log;
}
```

启用站点：
```bash
ln -s /etc/nginx/sites-available/newdomain.com /etc/nginx/sites-enabled/
nginx -t        # 测试配置
systemctl reload nginx
```

### 2.7 SSL 证书（Let's Encrypt）

```bash
# 安装 certbot
apt install -y certbot python3-certbot-nginx

# 申请证书
certbot --nginx -d newdomain.com -d www.newdomain.com

# 自动续期（certbot 默认会加 cron，验证一下）
certbot renew --dry-run
```

### 2.8 上传管理后台前端

在本地构建（同 1.8）后上传：

```bash
# 创建目录
mkdir -p /var/www/newdomain.com

# 从本地上传（在本地 PowerShell 执行）
scp -r D:\Code\Pizza\soybean-admin-temp\dist\* root@服务器IP:/var/www/newdomain.com/

# 服务器上验证
ls /var/www/newdomain.com/index.html   # 应存在
```

### 2.9 创建上传目录 & 防火墙

```bash
mkdir -p /var/www/newdomain.com/uploads
chmod 755 /var/www/newdomain.com/uploads

# 防火墙
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 22/tcp
ufw enable
```

---

## 三、验证清单

部署完成后逐项检查：

| # | 检查项 | 命令 / 方法 |
|---|--------|-----------|
| 1 | 后端健康检查 | `curl https://新域名.com/health` → `{"status":"ok"}` |
| 2 | API 可访问 | `curl https://新域名.com/api/v1/config` |
| 3 | 管理后台可访问 | 浏览器打开 `https://新域名.com/admin/` → 应显示登录页 |
| 4 | 管理后台菜单点击刷新 | 点左侧菜单不应空白，正常跳转 |
| 5 | 上传目录可访问 | `curl -I https://新域名.com/uploads/` → 200 或 404（不能 502） |
| 6 | 微信支付回调可达 | `curl -X POST https://新域名.com/api/v1/pay/notify` → 不是 502 |
| 7 | PM2 进程运行 | `pm2 status` → online |
| 8 | 开机自启 | `pm2 startup` 已配置 |

---

## 四、常见问题

### Q: 管理后台菜单点击空白
**A:** 编辑 `soybean-admin-temp/src/views/_builtin/global-content/index.vue`，删除 `<Transition>` 上的 `mode="out-in"`，重新 build。

### Q: Nginx 报 502 Bad Gateway
**A:** 检查 Node 是否在运行（`pm2 status`），检查端口是否正确（`netstat -tlnp | grep 3000`）。

### Q: 数据库连接失败
**A:** 检查 `.env` 中的 `DB_HOST`/`DB_USER`/`DB_PASSWORD` 是否正确；MySQL 是否允许该用户本地连接。

### Q: 微信支付回调收不到
**A:** 确认 `.env` 中 `WX_PAY_NOTIFY_URL` 是 `https://新域名.com/api/v1/pay/notify`，域名必须备案且 HTTPS。

### Q: deploy.py 编码报错
**A:** Windows GBK 编码下 `✓` 字符会崩，属无害错误。看日志里有没有 `OK` 行确认成功，别只看退出码。
