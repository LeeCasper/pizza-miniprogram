# 会员商城模块 Phase 1 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把"会员商城"从复用点单 `/products` 数据改造为独立模块：后台可配置商城分类（图片图标）与商城商品；小程序商城列表/详情读独立 `/shop/*` 接口；商品**不支持加入购物车**，**可收藏**，详情页"立即购买"先占位（Phase 2 接单独支付）；与点单系统完全解耦。

**Architecture:** 新增 5 张 `shop_*` 表（迁移一次性建全，Phase 2 的 `shop_orders`/`shop_order_items` 提前建好但本期不写业务）。后端新增 `shopProductService`/`shopCategoryService`/`shopFavoriteService` + 公开路由 `/api/v1/shop/*` + 管理路由 `/api/v1/admin/shop/*`，全部沿用现有 `productService`/`categoryService`/`adminApiController` 的写法（`{code:0,data}` 响应包、`log.error({err},'...')`、软删 + 可空外键）。后台 Soybean 按 CLAUDE.md 七步加 `shop` 多级菜单与三张视图。小程序把商城 tab 改读 `/shop/products`+`/shop/categories`，移除购物车步进器换成收藏心形，新建 `shop-detail` 与 `favorites` 两个页面。

**Tech Stack:** Express + mysql2 pool + JWT（pizza-server）；Vue3 + Vite + NaiveUI + elegant-router（soybean-admin-temp）；WeChat WXML/WXSS/JS 黏土风（miniprogram）。

## Global Constraints

> 以下为全局约束，**每个任务的要求都隐含包含本节**。值/格式逐字照抄，不得改写。

- **黏土/玻璃 UI**：复用 `app.wxss` 的 `--glass-*` / `--radius-*` / `--color-*` token；**任何地方都不得使用 `backdrop-filter`**（会触发回前台重栅格化闪烁）。
- **WXSS 限制**：禁止 `background` 简写带 `/`（如 `center/cover` 会被静默丢弃），用 `background-image`/`background-size`/`background-position`/`background-repeat` 长写；背景图用绝对定位 `<image>` 而非 CSS `url()`；rpx 为主单位（750rpx = 屏宽）。
- **新小程序页面**：必须建 `<page>.json`，含 `"navigationStyle": "custom"` 与 `"navigationBarTitleText": "页面名"`；新增页面要同步 `app.json` `pages`、`main.js` 路由、`profile.js` actions（涉及时）。
- **新后台页面**：按 CLAUDE.md 七步（view → routes/index.ts → elegant/imports.ts → elegant/transform.ts → typings/elegant-router.d.ts → i18n zh-cn/en-us → service/api + index.ts barrel）。**elegant-router 路由名必须全小写**，与目录自动生成名精确匹配才能覆盖（`shop`、`shop_products_list` 等）。
- **迁移幂等**：建表用 `CREATE TABLE IF NOT EXISTS`；改列用 `MODIFY COLUMN`（生产 MySQL 不支持 `ADD COLUMN IF NOT EXISTS`）；新迁移文件要同步进 `db/schema.sql`，并追加到 `soybean-admin-temp/deploy.py` 的硬编码迁移清单。
- **软删 + 外键安全**：`shop_products` 软删（`is_deleted`），外键可空（`ON DELETE SET NULL`）；分类删除前如有未删商品引用则拒绝（400）。
- **审计**：管理写操作 fire-and-forget 调 `auditService`（NEVER throws），不阻塞主流程。
- **后台构建**：`pnpm build`/`pnpm gen-route` 前必须 `$env:PATH = "C:\Program Files\nodejs;" + $env:PATH`（系统默认 Node v18，需 v22）。
- **退款逻辑（Phase 2）**：商城退款自包含于 `shopOrderService`，**绝不修改 `refundService`**。本期不涉及。
- **响应约定**：成功 `{ code: 0, data }`；错误 `{ code: 4xx, message }`。公开 controller 用 `(req,res,next)` + `next(err)`；admin controller 用 try/catch 返回 500。
- **YAGNI 范围外**：SKU 规格、商城订单用积分/优惠券、评价、商城搜索、多商品合并下单 —— 本期都不做。

---

## File Structure

**pizza-server/**
- `db/migrate_shop_module.sql` — 新建：5 张 `shop_*` 表（一次性建全）
- `db/schema.sql` — 修改：追加 5 张表定义（与迁移一致）
- `src/services/shopProductService.js` — 新建：商城商品查询/CRUD/软删/上下架/收藏 join
- `src/services/shopCategoryService.js` — 新建：商城分类查询/CRUD/引用计数/删除
- `src/services/shopFavoriteService.js` — 新建：收藏列表/添加/移除
- `src/controllers/shopController.js` — 新建：公开商城接口
- `src/controllers/adminShopController.js` — 新建：管理商城接口
- `src/routes/shop.js` — 新建：`/api/v1/shop/*` 路由
- `src/routes/adminApi.js` — 修改：挂 `/shop/*` 管理路由
- `src/app.js` — 修改：挂 `/api/v1/shop`

**soybean-admin-temp/**
- `src/service/api/shop.ts` — 新建：商城商品/分类 API
- `src/service/api/index.ts` — 修改：barrel 导出 `./shop`
- `src/components/common/MultiImageUpload.vue` — 新建：多图上传（基于 ImageUpload.vue）
- `src/views/shop/products/list/index.vue` — 新建
- `src/views/shop/products/form/index.vue` — 新建
- `src/views/shop/categories/index.vue` — 新建
- `src/router/routes/index.ts` — 修改：加 `shop` 多级路由（order 2.5）
- `src/router/elegant/imports.ts`、`transform.ts`、`src/typings/elegant-router.d.ts` — `pnpm gen-route` 自动生成（无需手改，构建会刷新）
- `src/locales/langs/zh-cn.ts`、`en-us.ts` — 修改：route 段加商城 i18n
- `deploy.py` — 修改：迁移清单追加 `migrate_shop_module.sql`

**miniprogram/**
- `pages/main/main.js`、`tpl-shop.wxml`、`main.wxss` — 修改：商城 tab 改读 `/shop/*` + 收藏心形
- `pages/shop/shop.js`、`shop.wxml`、`shop.wxss` — 修改：独立商城页同步
- `pages/shop-detail/{shop-detail.js,.wxml,.wxss,.json}` — 新建：商品详情
- `pages/favorites/{favorites.js,.wxml,.wxss,.json}` — 新建：我的收藏
- `app.json` — 修改：注册 shop-detail / favorites
- `pages/profile/profile.js` — 修改：收藏入口指向 favorites

---

## Task 1: 数据库迁移（5 张 shop_* 表）

**Files:**
- Create: `pizza-server/db/migrate_shop_module.sql`
- Modify: `pizza-server/db/schema.sql`（文件末尾追加同样 5 段建表）
- Modify: `soybean-admin-temp/deploy.py`（迁移清单追加一行）

**Interfaces:**
- Produces: 表 `shop_categories(key,name,icon,sort_order,is_active,...)`、`shop_products(id,shop_category_key,name,subtitle,price,original_price,main_image,images,detail_desc,stock,sales,tag,is_available,sort_order,is_deleted,...)`、`shop_favorites(id,user_id,shop_product_id,...)`、`shop_orders`、`shop_order_items`。后续所有任务依赖这些列名。

- [ ] **Step 1: 新建迁移文件 `pizza-server/db/migrate_shop_module.sql`**

```sql
-- 会员商城模块：5 张 shop_* 表（一次性建全；shop_orders/shop_order_items 为 Phase 2 预留）
-- 幂等：CREATE TABLE IF NOT EXISTS

CREATE TABLE IF NOT EXISTS shop_categories (
  `key` VARCHAR(30) NOT NULL COMMENT '分类标识(^[a-z0-9_]+$)',
  name VARCHAR(50) NOT NULL COMMENT '分类名',
  icon VARCHAR(500) DEFAULT NULL COMMENT '分类图标图片URL',
  sort_order INT DEFAULT 0,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shop_products (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  shop_category_key VARCHAR(30) DEFAULT NULL,
  name VARCHAR(100) NOT NULL,
  subtitle VARCHAR(200) DEFAULT NULL,
  price DECIMAL(10,2) NOT NULL,
  original_price DECIMAL(10,2) DEFAULT NULL,
  main_image VARCHAR(500) DEFAULT NULL,
  images JSON DEFAULT NULL COMMENT '详情轮播图URL数组',
  detail_desc TEXT,
  stock INT NOT NULL DEFAULT 0,
  sales INT NOT NULL DEFAULT 0,
  tag VARCHAR(30) DEFAULT NULL COMMENT '角标文案(如 新品/热卖)',
  is_available TINYINT(1) DEFAULT 1,
  sort_order INT DEFAULT 0,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_shop_cat (shop_category_key),
  KEY idx_shop_avail (is_available),
  CONSTRAINT fk_shop_product_cat FOREIGN KEY (shop_category_key)
    REFERENCES shop_categories(`key`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shop_favorites (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  shop_product_id INT UNSIGNED NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_user_product (user_id, shop_product_id),
  KEY idx_fav_user (user_id),
  CONSTRAINT fk_fav_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_fav_product FOREIGN KEY (shop_product_id)
    REFERENCES shop_products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Phase 2 预留（本期不写业务，仅建表）
CREATE TABLE IF NOT EXISTS shop_orders (
  id VARCHAR(20) NOT NULL COMMENT 'SH+YYYYMMDD+3位序号',
  user_id INT UNSIGNED NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  paid_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  payment_method ENUM('wechat','balance') DEFAULT NULL,
  status ENUM('pending','paid','shipped','completed','cancelled') NOT NULL DEFAULT 'pending',
  recipient_name VARCHAR(50) DEFAULT NULL,
  recipient_phone VARCHAR(20) DEFAULT NULL,
  recipient_address VARCHAR(255) DEFAULT NULL,
  shipping_company VARCHAR(50) DEFAULT NULL,
  tracking_no VARCHAR(50) DEFAULT NULL,
  note VARCHAR(255) DEFAULT NULL,
  paid_at TIMESTAMP NULL DEFAULT NULL,
  shipped_at TIMESTAMP NULL DEFAULT NULL,
  completed_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_shop_order_user (user_id),
  KEY idx_shop_order_status (status),
  CONSTRAINT fk_shop_order_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shop_order_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id VARCHAR(20) NOT NULL,
  shop_product_id INT UNSIGNED DEFAULT NULL,
  product_name VARCHAR(100) NOT NULL,
  product_image VARCHAR(500) DEFAULT NULL,
  price DECIMAL(10,2) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  subtotal DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_shop_item_order (order_id),
  CONSTRAINT fk_shop_item_order FOREIGN KEY (order_id)
    REFERENCES shop_orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_shop_item_product FOREIGN KEY (shop_product_id)
    REFERENCES shop_products(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

- [ ] **Step 2: 同步 `pizza-server/db/schema.sql`**

把上面 5 段 `CREATE TABLE IF NOT EXISTS ...` 原样追加到 `db/schema.sql` 文件末尾（当前末尾约为 `lucky_wheel_draws` 表之后）。内容与迁移文件逐字一致。

- [ ] **Step 3: 追加 deploy.py 迁移清单**

在 `soybean-admin-temp/deploy.py` 的 `migrations` 列表（约 `:49-65`，末项为 `'pizza-server/db/migrate_redeem_coupon_order.sql',` 后接 `]`）中，在 `]` 之前追加一行：

```python
    'pizza-server/db/migrate_shop_module.sql',
```

- [ ] **Step 4: 本地执行迁移并验证**

Run（确保已 `$env:PATH = "C:\Program Files\nodejs;" + $env:PATH`，在 pizza-server 目录）:
```bash
mysql -u root -p pizza < db/migrate_shop_module.sql
```
然后验证：
```sql
SHOW TABLES LIKE 'shop_%';
-- 期望 5 行：shop_categories, shop_favorites, shop_order_items, shop_orders, shop_products
DESCRIBE shop_products;
-- 期望含 shop_category_key / images(json) / is_deleted 等列
```
Expected: 5 张表存在；`shop_products` 列齐全。重复执行迁移应无报错（`IF NOT EXISTS` 幂等）。

- [ ] **Step 5: Commit**

```bash
git add pizza-server/db/migrate_shop_module.sql pizza-server/db/schema.sql soybean-admin-temp/deploy.py
git commit -m "feat: v1.4.0 shop module DB migration (5 shop_* tables)"
```

---

## Task 2: 后端 Service 层（3 个 service）

**Files:**
- Create: `pizza-server/src/services/shopProductService.js`
- Create: `pizza-server/src/services/shopCategoryService.js`
- Create: `pizza-server/src/services/shopFavoriteService.js`

**Interfaces:**
- Produces:
  - `shopProductService.findAll(category, userId)` / `findById(id, userId)` / `adminList()` / `adminFindById(id)` / `create(data)` / `update(id, data)` / `softDelete(id)` / `toggle(id)` —— 返回对象含 `images:[]`、`isFavorited:bool`
  - `shopCategoryService.findAll()` / `adminList()` / `findByKey(key)` / `create({key,name,icon,sortOrder,isActive})` / `update(key,data)` / `countProducts(key)` / `remove(key)`
  - `shopFavoriteService.list(userId)` / `add(userId, productId)` / `remove(userId, productId)` / `exists(productId)`
- Consumes: Task 1 的表与列。

- [ ] **Step 1: 新建 `shopProductService.js`**

```js
// src/services/shopProductService.js — 会员商城商品
const pool = require('../config/database');

const shopProductService = {
  // 公开：上架且未删；userId 存在时 LEFT JOIN 收藏表标记 is_favorited
  async findAll(category, userId) {
    const params = [];
    let favSelect = '0 AS is_favorited';
    let favJoin = '';
    if (userId) {
      favSelect = 'CASE WHEN f.id IS NULL THEN 0 ELSE 1 END AS is_favorited';
      favJoin = 'LEFT JOIN shop_favorites f ON f.shop_product_id = p.id AND f.user_id = ?';
      params.push(userId);
    }
    let sql = `SELECT p.*, ${favSelect} FROM shop_products p ${favJoin}
      WHERE p.is_available = 1 AND p.is_deleted = 0`;
    if (category && category !== 'all') {
      sql += ' AND p.shop_category_key = ?';
      params.push(category);
    }
    sql += ' ORDER BY p.sort_order ASC, p.id ASC';
    const [rows] = await pool.query(sql, params);
    return rows.map(formatShopProduct);
  },

  async findById(id, userId) {
    const params = [];
    let favSelect = '0 AS is_favorited';
    let favJoin = '';
    if (userId) {
      favSelect = 'CASE WHEN f.id IS NULL THEN 0 ELSE 1 END AS is_favorited';
      favJoin = 'LEFT JOIN shop_favorites f ON f.shop_product_id = p.id AND f.user_id = ?';
      params.push(userId);
    }
    params.push(id);
    const [rows] = await pool.query(
      `SELECT p.*, ${favSelect} FROM shop_products p ${favJoin}
       WHERE p.id = ? AND p.is_deleted = 0`,
      params
    );
    return rows[0] ? formatShopProduct(rows[0]) : null;
  },

  async adminList() {
    const [rows] = await pool.query(
      'SELECT * FROM shop_products WHERE is_deleted = 0 ORDER BY sort_order ASC, id ASC'
    );
    return rows.map(formatShopProduct);
  },

  async adminFindById(id) {
    const [rows] = await pool.query('SELECT * FROM shop_products WHERE id = ?', [id]);
    return rows[0] ? formatShopProduct(rows[0]) : null;
  },

  async create(data) {
    const {
      shop_category_key = null, name, subtitle = null, price,
      original_price = null, main_image = null, images = [],
      detail_desc = null, stock = 0, tag = null,
      is_available = 1, sort_order = 0,
    } = data;
    const [result] = await pool.query(
      `INSERT INTO shop_products
       (shop_category_key, name, subtitle, price, original_price, main_image, images, detail_desc, stock, tag, is_available, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [shop_category_key, name, subtitle, price, original_price, main_image,
       JSON.stringify(Array.isArray(images) ? images : []), detail_desc, stock, tag,
       is_available ? 1 : 0, sort_order]
    );
    return this.adminFindById(result.insertId);
  },

  async update(id, data) {
    const fieldMap = {
      shop_category_key: 'shop_category_key',
      name: 'name',
      subtitle: 'subtitle',
      price: 'price',
      original_price: 'original_price',
      main_image: 'main_image',
      detail_desc: 'detail_desc',
      stock: 'stock',
      tag: 'tag',
      sort_order: 'sort_order',
    };
    const sets = [];
    const params = [];
    for (const [key, col] of Object.entries(fieldMap)) {
      if (data[key] !== undefined) {
        sets.push(`\`${col}\` = ?`);
        params.push(data[key]);
      }
    }
    if (data.is_available !== undefined) {
      sets.push('is_available = ?');
      params.push(data.is_available ? 1 : 0);
    }
    if (data.images !== undefined) {
      sets.push('images = ?');
      params.push(JSON.stringify(Array.isArray(data.images) ? data.images : []));
    }
    if (sets.length === 0) return this.adminFindById(id);
    sets.push('updated_at = NOW()');
    params.push(id);
    await pool.query(`UPDATE shop_products SET ${sets.join(', ')} WHERE id = ?`, params);
    return this.adminFindById(id);
  },

  async softDelete(id) {
    await pool.query('UPDATE shop_products SET is_deleted = 1 WHERE id = ?', [id]);
  },

  async toggle(id) {
    await pool.query('UPDATE shop_products SET is_available = IF(is_available, 0, 1) WHERE id = ?', [id]);
    return this.adminFindById(id);
  },
};

function formatShopProduct(row) {
  if (!row) return null;
  const { is_favorited, ...rest } = row;
  return {
    ...rest,
    images: safeJson(row.images, []),
    isFavorited: !!is_favorited,
  };
}

function safeJson(val, d) {
  if (!val) return d;
  try { return typeof val === 'string' ? JSON.parse(val) : val; } catch (_) { return d; }
}

module.exports = shopProductService;
```

- [ ] **Step 2: 新建 `shopCategoryService.js`**

```js
// src/services/shopCategoryService.js — 会员商城分类
const pool = require('../config/database');

const shopCategoryService = {
  async findAll() {
    const [rows] = await pool.query(
      'SELECT * FROM shop_categories WHERE is_active = 1 ORDER BY sort_order ASC, `key` ASC'
    );
    return rows;
  },

  async adminList() {
    const [rows] = await pool.query(
      'SELECT * FROM shop_categories ORDER BY sort_order ASC, `key` ASC'
    );
    return rows;
  },

  async findByKey(key) {
    const [rows] = await pool.query('SELECT * FROM shop_categories WHERE `key` = ?', [key]);
    return rows[0] || null;
  },

  async create({ key, name, icon = null, sortOrder = 0, isActive }) {
    await pool.query(
      'INSERT INTO shop_categories (`key`, name, icon, sort_order, is_active) VALUES (?, ?, ?, ?, ?)',
      [key, name, icon, sortOrder, isActive === undefined ? 1 : isActive ? 1 : 0]
    );
    return this.findByKey(key);
  },

  async update(key, data) {
    const fieldMap = { name: 'name', icon: 'icon', sortOrder: 'sort_order', isActive: 'is_active' };
    const sets = [];
    const params = [];
    for (const [k, col] of Object.entries(fieldMap)) {
      if (data[k] !== undefined) {
        if (col === 'is_active') {
          sets.push('is_active = ?');
          params.push(data[k] ? 1 : 0);
        } else {
          sets.push(`\`${col}\` = ?`);
          params.push(data[k]);
        }
      }
    }
    if (sets.length === 0) return this.findByKey(key);
    sets.push('updated_at = NOW()');
    params.push(key);
    await pool.query(`UPDATE shop_categories SET ${sets.join(', ')} WHERE \`key\` = ?`, params);
    return this.findByKey(key);
  },

  async countProducts(key) {
    const [rows] = await pool.query(
      'SELECT COUNT(*) AS cnt FROM shop_products WHERE shop_category_key = ? AND is_deleted = 0',
      [key]
    );
    return rows[0].cnt;
  },

  async remove(key) {
    // 解绑已软删商品的引用（避免外键约束阻塞），再删分类
    await pool.query(
      'UPDATE shop_products SET shop_category_key = NULL WHERE shop_category_key = ? AND is_deleted = 1',
      [key]
    );
    await pool.query('DELETE FROM shop_categories WHERE `key` = ?', [key]);
  },
};

module.exports = shopCategoryService;
```

- [ ] **Step 3: 新建 `shopFavoriteService.js`**

```js
// src/services/shopFavoriteService.js — 会员商城收藏
const pool = require('../config/database');

const shopFavoriteService = {
  async list(userId) {
    const [rows] = await pool.query(
      `SELECT p.* FROM shop_favorites f
       JOIN shop_products p ON p.id = f.shop_product_id
       WHERE f.user_id = ? AND p.is_deleted = 0
       ORDER BY f.created_at DESC`,
      [userId]
    );
    return rows.map(formatFavorite);
  },

  async add(userId, productId) {
    await pool.query(
      'INSERT INTO shop_favorites (user_id, shop_product_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE id = id',
      [userId, productId]
    );
  },

  async remove(userId, productId) {
    await pool.query(
      'DELETE FROM shop_favorites WHERE user_id = ? AND shop_product_id = ?',
      [userId, productId]
    );
  },

  async exists(productId) {
    const [rows] = await pool.query(
      'SELECT id FROM shop_products WHERE id = ? AND is_deleted = 0',
      [productId]
    );
    return rows.length > 0;
  },
};

function formatFavorite(row) {
  return {
    ...row,
    images: safeJson(row.images, []),
    isFavorited: true,
  };
}

function safeJson(val, d) {
  if (!val) return d;
  try { return typeof val === 'string' ? JSON.parse(val) : val; } catch (_) { return d; }
}

module.exports = shopFavoriteService;
```

- [ ] **Step 4: 验证（require 不报错）**

Run（pizza-server 目录）:
```bash
node -e "require('./src/services/shopProductService'); require('./src/services/shopCategoryService'); require('./src/services/shopFavoriteService'); console.log('services OK')"
```
Expected: 输出 `services OK`，无语法错误。

- [ ] **Step 5: Commit**

```bash
git add pizza-server/src/services/shopProductService.js pizza-server/src/services/shopCategoryService.js pizza-server/src/services/shopFavoriteService.js
git commit -m "feat: v1.4.0 shop services (product/category/favorite)"
```

---

## Task 3: 公开 API（controller + routes + app.js 挂载）

**Files:**
- Create: `pizza-server/src/controllers/shopController.js`
- Create: `pizza-server/src/routes/shop.js`
- Modify: `pizza-server/src/app.js`（路由 import 段 `:23-34` 加一行；mount 段 `:154-169` 加一行）

**Interfaces:**
- Consumes: Task 2 的 3 个 service；`middleware/auth` 的 `{ auth, optionalAuth }`。
- Produces: `GET /api/v1/shop/categories`、`GET /api/v1/shop/products?category=`、`GET /api/v1/shop/products/:id`、`GET /api/v1/shop/favorites`、`POST /api/v1/shop/favorites/:productId`、`DELETE /api/v1/shop/favorites/:productId`。

- [ ] **Step 1: 新建 `shopController.js`**

```js
// src/controllers/shopController.js — 会员商城公开接口
const shopProductService = require('../services/shopProductService');
const shopCategoryService = require('../services/shopCategoryService');
const shopFavoriteService = require('../services/shopFavoriteService');

const shopController = {
  async listCategories(req, res, next) {
    try {
      const data = await shopCategoryService.findAll();
      res.json({ code: 0, data });
    } catch (err) { next(err); }
  },

  async listProducts(req, res, next) {
    try {
      const category = req.query.category;
      const userId = req.user ? req.user.id : null;
      const data = await shopProductService.findAll(category, userId);
      res.json({ code: 0, data });
    } catch (err) { next(err); }
  },

  async productDetail(req, res, next) {
    try {
      const userId = req.user ? req.user.id : null;
      const data = await shopProductService.findById(req.params.id, userId);
      if (!data) return res.status(404).json({ code: 404, message: '商品不存在' });
      res.json({ code: 0, data });
    } catch (err) { next(err); }
  },

  async listFavorites(req, res, next) {
    try {
      const data = await shopFavoriteService.list(req.user.id);
      res.json({ code: 0, data });
    } catch (err) { next(err); }
  },

  async addFavorite(req, res, next) {
    try {
      const productId = req.params.productId;
      const exists = await shopFavoriteService.exists(productId);
      if (!exists) return res.status(404).json({ code: 404, message: '商品不存在' });
      await shopFavoriteService.add(req.user.id, productId);
      res.json({ code: 0, message: '收藏成功' });
    } catch (err) { next(err); }
  },

  async removeFavorite(req, res, next) {
    try {
      await shopFavoriteService.remove(req.user.id, req.params.productId);
      res.json({ code: 0, message: '已取消收藏' });
    } catch (err) { next(err); }
  },
};

module.exports = shopController;
```

- [ ] **Step 2: 新建 `routes/shop.js`**

```js
// src/routes/shop.js — 会员商城公开路由（挂载于 /api/v1/shop）
const express = require('express');
const router = express.Router();
const { auth, optionalAuth } = require('../middleware/auth');
const shopController = require('../controllers/shopController');

// 公开（带 optionalAuth 以便返回 isFavorited）
router.get('/categories', shopController.listCategories);
router.get('/products', optionalAuth, shopController.listProducts);
router.get('/products/:id', optionalAuth, shopController.productDetail);

// 需登录
router.get('/favorites', auth, shopController.listFavorites);
router.post('/favorites/:productId', auth, shopController.addFavorite);
router.delete('/favorites/:productId', auth, shopController.removeFavorite);

module.exports = router;
```

- [ ] **Step 3: 在 `app.js` 路由 import 段加一行**

在其它 `const xxxRoutes = require('./routes/xxx');`（约 `:23-34`）附近加：
```js
const shopRoutes = require('./routes/shop');
```

- [ ] **Step 4: 在 `app.js` mount 段加一行**

在其它 `app.use('/api/v1/xxx', xxxRoutes);`（约 `:154-169`）附近，紧随 `app.use('/api/v1/products', productRoutes);` 之后加：
```js
app.use('/api/v1/shop', shopRoutes);
```
（由全局 `/api/` 限流 200/15min 覆盖，无需单独限流。）

- [ ] **Step 5: 启动并 curl 验证**

Run（pizza-server 目录，确保 Node v22 PATH）:
```bash
npm run dev
```
另开终端（先在后台插一条测试数据：`INSERT INTO shop_categories(\`key\`,name) VALUES('featured','精选好物'); INSERT INTO shop_products(name,price,shop_category_key) VALUES('测试商品',9.90,'featured');`）：
```bash
curl http://localhost:3000/api/v1/shop/categories
curl http://localhost:3000/api/v1/shop/products
curl http://localhost:3000/api/v1/shop/products/1
```
Expected:
- `/categories` → `{"code":0,"data":[{"key":"featured","name":"精选好物",...}]}`
- `/products` → `{"code":0,"data":[{"id":1,"name":"测试商品","images":[],"isFavorited":false,...}]}`
- `/products/1` → `{"code":0,"data":{...}}`；不存在的 id → `{"code":404,"message":"商品不存在"}`
- `/favorites` 无 token → 401。

- [ ] **Step 6: Commit**

```bash
git add pizza-server/src/controllers/shopController.js pizza-server/src/routes/shop.js pizza-server/src/app.js
git commit -m "feat: v1.4.0 shop public API (/api/v1/shop)"
```

---

## Task 4: 管理 API（adminShopController + adminApi 路由）

**Files:**
- Create: `pizza-server/src/controllers/adminShopController.js`
- Modify: `pizza-server/src/routes/adminApi.js`（顶部加 import；分类路由块 `:33-36` 之后插入 shop 块）

**Interfaces:**
- Consumes: Task 2 service；`utils/logger` 的 `createLogger`。
- Produces: `GET/POST /api/v1/admin/shop/products`、`GET/PUT/DELETE /api/v1/admin/shop/products/:id`、`PUT /api/v1/admin/shop/products/:id/toggle`、`GET/POST /api/v1/admin/shop/categories`、`PUT/DELETE /api/v1/admin/shop/categories/:key`。全部已被 `adminApi.js` 顶部 `router.use(auth, adminOnly)` 守护。

> **审计说明**：对照现有 `adminApiController` —— 其商品/分类 CRUD **不调** `auditService`（audit 仅用于积分/会员等级等敏感操作，见 `:521 auditService.record`）。为保持一致，商城商品/分类 CRUD 同样不加审计。这是有意为之，符合"复用现有写法"原则。

- [ ] **Step 1: 新建 `adminShopController.js`**

```js
// src/controllers/adminShopController.js — 会员商城管理接口（/api/v1/admin/shop/*）
const shopProductService = require('../services/shopProductService');
const shopCategoryService = require('../services/shopCategoryService');
const { createLogger } = require('../utils/logger');
const log = createLogger('AdminShop');

const adminShopController = {
  // ───── 商品 ─────
  async listProducts(req, res) {
    try {
      const data = await shopProductService.adminList();
      res.json({ code: 0, data });
    } catch (err) {
      log.error({ err }, 'admin list shop products failed');
      res.status(500).json({ code: 500, message: '获取商城商品失败' });
    }
  },

  async getProduct(req, res) {
    try {
      const data = await shopProductService.adminFindById(req.params.id);
      if (!data) return res.status(404).json({ code: 404, message: '商品不存在' });
      res.json({ code: 0, data });
    } catch (err) {
      log.error({ err }, 'admin get shop product failed');
      res.status(500).json({ code: 500, message: '获取商城商品失败' });
    }
  },

  async createProduct(req, res) {
    try {
      const b = req.body;
      const data = await shopProductService.create({
        shop_category_key: b.shop_category_key || null,
        name: b.name,
        subtitle: b.subtitle || null,
        price: parseFloat(b.price),
        original_price: (b.original_price !== undefined && b.original_price !== null && b.original_price !== '')
          ? parseFloat(b.original_price) : null,
        main_image: b.main_image || null,
        images: Array.isArray(b.images) ? b.images : [],
        detail_desc: b.detail_desc || null,
        stock: b.stock !== undefined ? parseInt(b.stock) : 0,
        tag: b.tag || null,
        is_available: b.is_available !== undefined ? (b.is_available ? 1 : 0) : 1,
        sort_order: b.sort_order !== undefined ? parseInt(b.sort_order) : 0,
      });
      res.status(201).json({ code: 0, data });
    } catch (err) {
      log.error({ err }, 'admin create shop product failed');
      res.status(500).json({ code: 500, message: '创建商城商品失败' });
    }
  },

  async updateProduct(req, res) {
    try {
      const b = req.body;
      const updateData = {};
      if (b.shop_category_key !== undefined) updateData.shop_category_key = b.shop_category_key || null;
      if (b.name !== undefined) updateData.name = b.name;
      if (b.subtitle !== undefined) updateData.subtitle = b.subtitle || null;
      if (b.price !== undefined) updateData.price = parseFloat(b.price);
      if (b.original_price !== undefined) {
        updateData.original_price = (b.original_price === null || b.original_price === '') ? null : parseFloat(b.original_price);
      }
      if (b.main_image !== undefined) updateData.main_image = b.main_image || null;
      if (b.images !== undefined) updateData.images = Array.isArray(b.images) ? b.images : [];
      if (b.detail_desc !== undefined) updateData.detail_desc = b.detail_desc || null;
      if (b.stock !== undefined) updateData.stock = parseInt(b.stock);
      if (b.tag !== undefined) updateData.tag = b.tag || null;
      if (b.is_available !== undefined) updateData.is_available = b.is_available ? 1 : 0;
      if (b.sort_order !== undefined) updateData.sort_order = parseInt(b.sort_order);
      const data = await shopProductService.update(req.params.id, updateData);
      if (!data) return res.status(404).json({ code: 404, message: '商品不存在' });
      res.json({ code: 0, data });
    } catch (err) {
      log.error({ err }, 'admin update shop product failed');
      res.status(500).json({ code: 500, message: '更新商城商品失败' });
    }
  },

  async deleteProduct(req, res) {
    try {
      await shopProductService.softDelete(req.params.id);
      res.json({ code: 0, message: '删除成功' });
    } catch (err) {
      log.error({ err }, 'admin delete shop product failed');
      res.status(500).json({ code: 500, message: '删除商城商品失败' });
    }
  },

  async toggleProduct(req, res) {
    try {
      const data = await shopProductService.toggle(req.params.id);
      res.json({ code: 0, data });
    } catch (err) {
      log.error({ err }, 'admin toggle shop product failed');
      res.status(500).json({ code: 500, message: '切换上下架失败' });
    }
  },

  // ───── 分类 ─────
  async listCategories(req, res) {
    try {
      const data = await shopCategoryService.adminList();
      res.json({ code: 0, data });
    } catch (err) {
      log.error({ err }, 'admin list shop categories failed');
      res.status(500).json({ code: 500, message: '获取商城分类失败' });
    }
  },

  async createCategory(req, res) {
    try {
      const { key, name, icon, sortOrder, isActive } = req.body;
      if (!key || !/^[a-z0-9_]+$/.test(key)) {
        return res.status(400).json({ code: 400, message: '分类标识只能包含小写字母、数字和下划线' });
      }
      if (!name || !name.trim()) {
        return res.status(400).json({ code: 400, message: '分类名称不能为空' });
      }
      const existing = await shopCategoryService.findByKey(key);
      if (existing) {
        return res.status(400).json({ code: 400, message: '该分类标识已存在' });
      }
      const data = await shopCategoryService.create({ key, name, icon, sortOrder, isActive });
      res.status(201).json({ code: 0, data });
    } catch (err) {
      log.error({ err }, 'admin create shop category failed');
      res.status(500).json({ code: 500, message: '创建商城分类失败' });
    }
  },

  async updateCategory(req, res) {
    try {
      const data = await shopCategoryService.update(req.params.key, req.body);
      if (!data) return res.status(404).json({ code: 404, message: '分类不存在' });
      res.json({ code: 0, data });
    } catch (err) {
      log.error({ err }, 'admin update shop category failed');
      res.status(500).json({ code: 500, message: '更新商城分类失败' });
    }
  },

  async deleteCategory(req, res) {
    try {
      const count = await shopCategoryService.countProducts(req.params.key);
      if (count > 0) {
        return res.status(400).json({ code: 400, message: `该分类下还有 ${count} 个商品,无法删除` });
      }
      await shopCategoryService.remove(req.params.key);
      res.json({ code: 0, message: '删除成功' });
    } catch (err) {
      if (err.errno === 1451 || err.code === 'ER_ROW_IS_REFERENCED_2') {
        return res.status(400).json({ code: 400, message: '该分类仍被商品引用,无法删除' });
      }
      log.error({ err }, 'admin delete shop category failed');
      res.status(500).json({ code: 500, message: '删除商城分类失败' });
    }
  },
};

module.exports = adminShopController;
```

- [ ] **Step 2: 在 `adminApi.js` 顶部加 import**

在现有 `const ctrl = require('../controllers/adminApiController');` 附近追加：
```js
const shopCtrl = require('../controllers/adminShopController');
```

- [ ] **Step 3: 在 `adminApi.js` 分类路由块（`:33-36`）之后插入 shop 路由块**

```js
// ───── 会员商城：商品 ─────
router.get('/shop/products', shopCtrl.listProducts);
router.get('/shop/products/:id', shopCtrl.getProduct);
router.post('/shop/products', shopCtrl.createProduct);
router.put('/shop/products/:id', shopCtrl.updateProduct);
router.delete('/shop/products/:id', shopCtrl.deleteProduct);
router.put('/shop/products/:id/toggle', shopCtrl.toggleProduct);

// ───── 会员商城：分类 ─────
router.get('/shop/categories', shopCtrl.listCategories);
router.post('/shop/categories', shopCtrl.createCategory);
router.put('/shop/categories/:key', shopCtrl.updateCategory);
router.delete('/shop/categories/:key', shopCtrl.deleteCategory);
```
（商城管理路由无需 Joi `validate` —— 现有项目仅 couponTemplate/lucky 用 validate；controller 内已自校验。）

- [ ] **Step 4: curl 验证（需 admin JWT）**

先用管理员账号登录拿 token（沿用现有 `/api/v1/auth` 或后台登录后复制 token），然后：
```bash
curl -H "Authorization: Bearer <ADMIN_JWT>" http://localhost:3000/api/v1/admin/shop/products
curl -H "Authorization: Bearer <ADMIN_JWT>" http://localhost:3000/api/v1/admin/shop/categories
curl -X POST -H "Authorization: Bearer <ADMIN_JWT>" -H "Content-Type: application/json" \
  -d '{"key":"snack","name":"小吃"}' http://localhost:3000/api/v1/admin/shop/categories
```
Expected: 列表返回 `{"code":0,"data":[...]}`；建分类返回 201 `{"code":0,"data":{...}}`；重复 key → 400；非法 key（如 `Snack!`）→ 400；无 token → 401。

- [ ] **Step 5: Commit**

```bash
git add pizza-server/src/controllers/adminShopController.js pizza-server/src/routes/adminApi.js
git commit -m "feat: v1.4.0 shop admin API (/api/v1/admin/shop)"
```

---

## Task 5: 后台 API 模块 + 多图上传组件

**Files:**
- Create: `soybean-admin-temp/src/service/api/shop.ts`
- Modify: `soybean-admin-temp/src/service/api/index.ts`（barrel 加一行）
- Create: `soybean-admin-temp/src/components/common/MultiImageUpload.vue`

**Interfaces:**
- Produces: `AdminShopProduct`、`AdminShopCategory` 接口；`fetchShopProducts/fetchShopProduct/fetchCreateShopProduct/fetchUpdateShopProduct/fetchDeleteShopProduct/fetchToggleShopProduct/fetchShopCategories/fetchCreateShopCategory/fetchUpdateShopCategory/fetchDeleteShopCategory`；`<MultiImageUpload v-model="...">`（v-model 为 `string[]`）。
- Consumes: 既有 `../request` 的 `request<T>()`；`@/service/api/upload` 的 `fetchUploadImage`。

> **字段命名约定（与既有 product.ts/category.ts 完全一致）**：DECIMAL 列（price/original_price）后端返回 **string**；商品写操作发 **snake_case**（`shop_category_key`/`original_price`/`main_image`/`is_available`/`sort_order`/`images`/`stock`/`tag`）；分类写操作发 **camelCase**（`sortOrder`/`isActive`），读返回 snake（`sort_order`/`is_active`）—— 这正是 `category.ts` 既有的非对称，照搬。

- [ ] **Step 1: 新建 `service/api/shop.ts`**

```ts
import { request } from '../request';

export interface AdminShopProduct {
  id: number;
  shop_category_key: string | null;
  name: string;
  subtitle: string;
  price: string;
  original_price: string | null;
  main_image: string;
  images: string[];
  detail_desc: string;
  stock: number;
  sales: number;
  tag: string;
  is_available: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface AdminShopCategory {
  key: string;
  name: string;
  icon: string;
  sort_order: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

// ───── 商品 ─────
export function fetchShopProducts() {
  return request<AdminShopProduct[]>({ url: '/shop/products' });
}

export function fetchShopProduct(id: number) {
  return request<AdminShopProduct>({ url: `/shop/products/${id}` });
}

export function fetchCreateShopProduct(data: Record<string, any>) {
  return request<AdminShopProduct>({ url: '/shop/products', method: 'post', data });
}

export function fetchUpdateShopProduct(id: number, data: Record<string, any>) {
  return request<AdminShopProduct>({ url: `/shop/products/${id}`, method: 'put', data });
}

export function fetchDeleteShopProduct(id: number) {
  return request<void>({ url: `/shop/products/${id}`, method: 'delete' });
}

export function fetchToggleShopProduct(id: number) {
  return request<AdminShopProduct>({ url: `/shop/products/${id}/toggle`, method: 'put' });
}

// ───── 分类 ─────
export function fetchShopCategories() {
  return request<AdminShopCategory[]>({ url: '/shop/categories' });
}

export function fetchCreateShopCategory(data: Record<string, any>) {
  return request<AdminShopCategory>({ url: '/shop/categories', method: 'post', data });
}

export function fetchUpdateShopCategory(key: string, data: Record<string, any>) {
  return request<AdminShopCategory>({ url: `/shop/categories/${key}`, method: 'put', data });
}

export function fetchDeleteShopCategory(key: string) {
  return request<void>({ url: `/shop/categories/${key}`, method: 'delete' });
}
```

- [ ] **Step 2: 在 `service/api/index.ts` barrel 追加导出**

在其它 `export * from './xxx';` 行（如 `export * from './product';`）旁追加：
```ts
export * from './shop';
```

- [ ] **Step 3: 新建 `components/common/MultiImageUpload.vue`**

（基于既有 `ImageUpload.vue` 改为多图：`modelValue` 为 `string[]`，逐张上传追加，悬停删除，达到 `max` 隐藏上传格子。样式与单图一致。）

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { NButton, NImage, NSpin } from 'naive-ui';
import { fetchUploadImage } from '@/service/api/upload';

defineOptions({ name: 'MultiImageUpload' });

const props = withDefaults(
  defineProps<{
    modelValue: string[];
    width?: number;
    height?: number;
    max?: number;
  }>(),
  {
    width: 120,
    height: 120,
    max: 5,
  },
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: string[]): void;
}>();

const uploading = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

const tileStyle = {
  width: `${props.width}px`,
  height: `${props.height}px`,
};

function triggerUpload() {
  fileInput.value?.click();
}

async function handleFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  const validMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!validMimes.includes(file.type)) {
    window.$message?.warning('仅支持 JPG/PNG/GIF/WebP 图片');
    input.value = '';
    return;
  }

  uploading.value = true;
  const { data, error } = await fetchUploadImage(file);
  uploading.value = false;
  input.value = '';

  if (!error && data) {
    emit('update:modelValue', [...props.modelValue, data.url]);
    window.$message?.success('上传成功');
  } else {
    window.$message?.error(error?.message || '上传失败');
  }
}

function handleRemove(index: number) {
  const next = props.modelValue.slice();
  next.splice(index, 1);
  emit('update:modelValue', next);
}
</script>

<template>
  <div class="multi-image-upload flex flex-wrap gap-2">
    <div
      v-for="(url, index) in modelValue"
      :key="index"
      class="upload-preview relative inline-block"
    >
      <NImage
        :src="url"
        :width="width"
        :height="height"
        object-fit="cover"
        class="rounded-md overflow-hidden"
        :preview-disabled="true"
      />
      <div class="upload-overlay absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity rounded-md">
        <NButton size="tiny" circle secondary type="error" title="删除图片" @click="handleRemove(index)">
          <template #icon>
            <span class="i-mdi:delete-outline text-sm"></span>
          </template>
        </NButton>
      </div>
    </div>

    <div
      v-if="modelValue.length < max"
      class="upload-dropzone select-none"
      :style="tileStyle"
      role="button"
      tabindex="0"
      @click="triggerUpload"
    >
      <NSpin :show="uploading" size="small">
        <div class="flex flex-col items-center gap-1">
          <span class="text-3xl opacity-30 i-mdi:cloud-upload-outline"></span>
          <span class="text-xs opacity-50">{{ uploading ? '上传中…' : '添加图片' }}</span>
        </div>
      </NSpin>
    </div>

    <input
      ref="fileInput"
      type="file"
      accept="image/jpeg,image/png,image/gif,image/webp"
      class="hidden"
      @change="handleFileChange"
    />
  </div>
</template>

<style scoped>
.upload-dropzone {
  border: 2px dashed var(--n-border-color);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: border-color 0.2s;
}
.upload-dropzone:hover {
  border-color: var(--primary-color, #D32F2F);
}
.upload-overlay {
  transition: opacity 0.2s;
}
</style>
```

- [ ] **Step 4: 验证（类型检查）**

Run（soybean-admin-temp 目录，先 `$env:PATH = "C:\Program Files\nodejs;" + $env:PATH`）:
```bash
pnpm typecheck
```
Expected: 无 TS 报错（若项目无 `typecheck` 脚本，则留待 Task 6 的 `pnpm build` 一并校验）。

- [ ] **Step 5: Commit**

```bash
git add soybean-admin-temp/src/service/api/shop.ts soybean-admin-temp/src/service/api/index.ts soybean-admin-temp/src/components/common/MultiImageUpload.vue
git commit -m "feat: v1.4.0 admin shop API module + MultiImageUpload"
```

---

## Task 6: 后台商城页面（3 视图 + 路由 + i18n + gen-route + build）

**Files:**
- Create: `soybean-admin-temp/src/views/shop/products/list/index.vue`
- Create: `soybean-admin-temp/src/views/shop/products/form/index.vue`
- Create: `soybean-admin-temp/src/views/shop/categories/index.vue`
- Modify: `soybean-admin-temp/src/router/routes/index.ts`（在 `products` 块后插入 `shop` 多级路由）
- Modify: `soybean-admin-temp/src/locales/langs/zh-cn.ts` 与 `en-us.ts`（route 段加商城键）
- 自动生成（勿手改）：`src/router/elegant/imports.ts`、`routes.ts`、`transform.ts`、`src/typings/elegant-router.d.ts`（由 `pnpm gen-route` / `pnpm build` 刷新）

**Interfaces:**
- Consumes: Task 5 的 `shop.ts` API、`ImageUpload.vue`、`MultiImageUpload.vue`、`@/utils/format` 的 `formatPrice`、`@vicons/antd` 图标。
- Produces: 菜单"会员商城"→"商城商品"/"商城分类"；路由 `/shop/products`（列表）、`/shop/products/create`、`/shop/products/:id/edit`、`/shop/categories`。

> **目录↔路由对应（elegant-router 要求）**：`views/shop/products/list/` → 名 `shop_products_list`；`views/shop/products/form/` → 名 `shop_products_form`；`views/shop/categories/` → 名 `shop_categories`。自定义路由名必须全小写并与之精确匹配以覆盖自动生成项。列表路径用 `/shop/products`（不带 `/list`），使 form 的 `router.push('/shop/products')` 精确命中。

- [ ] **Step 1: 新建 `views/shop/products/list/index.vue`**

```vue
<script setup lang="ts">
import { h, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { NButton, NCard, NDataTable, NIcon, NImage, NSpace, NSwitch, NTag, useDialog } from 'naive-ui';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@vicons/antd';
import type { DataTableColumns } from 'naive-ui';
import { type AdminShopProduct, fetchDeleteShopProduct, fetchShopCategories, fetchShopProducts, fetchToggleShopProduct } from '@/service/api';
import { formatPrice } from '@/utils/format';

defineOptions({ name: 'ShopProductsList' });

const router = useRouter();
const dialog = useDialog();
const products = ref<AdminShopProduct[]>([]);
const categoryMap = ref<Record<string, string>>({});
const loading = ref(false);

const columns: DataTableColumns<AdminShopProduct> = [
  { title: 'ID', key: 'id', width: 60, align: 'center' },
  {
    title: '图片', key: 'main_image', width: 70,
    render(row) {
      return row.main_image
        ? h(NImage, { src: row.main_image, width: 44, height: 44, style: { borderRadius: '6px', objectFit: 'cover' } })
        : '—';
    }
  },
  { title: '名称', key: 'name', width: 180 },
  {
    title: '分类', key: 'shop_category_key', width: 100,
    render(row) {
      return row.shop_category_key
        ? h(NTag, { size: 'small', bordered: false }, () => categoryMap.value[row.shop_category_key as string] || row.shop_category_key)
        : '—';
    }
  },
  {
    title: '价格', key: 'price', width: 90, align: 'right',
    render(row) { return formatPrice(row.price); }
  },
  { title: '库存', key: 'stock', width: 70, align: 'center' },
  { title: '销量', key: 'sales', width: 70, align: 'center' },
  {
    title: '状态', key: 'is_available', width: 80,
    render(row) {
      return h(NSwitch, {
        value: !!row.is_available,
        onUpdateValue: (val: boolean) => handleToggle(row.id, val),
      });
    }
  },
  {
    title: '操作', key: 'actions', width: 100,
    render(row) {
      return h(NSpace, null, {
        default: () => [
          h(NButton, { size: 'small', quaternary: true, onClick: () => router.push(`/shop/products/${row.id}/edit`) }, { icon: () => h(NIcon, null, () => h(EditOutlined)) }),
          h(NButton, { size: 'small', quaternary: true, type: 'error', onClick: () => handleDelete(row.id) }, { icon: () => h(NIcon, null, () => h(DeleteOutlined)) }),
        ]
      });
    }
  },
];

async function loadProducts() {
  loading.value = true;
  const { data, error } = await fetchShopProducts();
  if (!error && data) products.value = data;
  loading.value = false;
}

async function loadCategories() {
  const { data, error } = await fetchShopCategories();
  if (!error && data) {
    const map: Record<string, string> = {};
    data.forEach(c => { map[c.key] = c.name; });
    categoryMap.value = map;
  }
}

async function handleToggle(id: number, val: boolean) {
  const product = products.value.find(p => p.id === id);
  if (product) product.is_available = val ? 1 : 0;
  const { error } = await fetchToggleShopProduct(id);
  if (error) {
    if (product) product.is_available = val ? 0 : 1;
    window.$message?.error('切换状态失败');
    return;
  }
  window.$message?.success(val ? '已上架' : '已下架');
}

async function handleDelete(id: number) {
  dialog.warning({
    title: '确认删除',
    content: '确定删除该商城商品？删除后将从列表移除（订单历史仍保留）。',
    positiveText: '确认删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      const { error } = await fetchDeleteShopProduct(id);
      if (!error) {
        window.$message?.success('商品已删除');
        loadProducts();
      }
    },
  });
}

onMounted(() => { loadProducts(); loadCategories(); });
</script>

<template>
  <NCard title="商城商品" :bordered="false" class="card-wrapper">
    <template #header-extra>
      <NButton type="primary" @click="router.push('/shop/products/create')">
        <template #icon><NIcon><PlusOutlined /></NIcon></template>
        新建商品
      </NButton>
    </template>
    <NDataTable :columns="columns" :data="products" :loading="loading" :row-key="(r: AdminShopProduct) => r.id" />
  </NCard>
</template>

<style scoped></style>
```

- [ ] **Step 2: 新建 `views/shop/products/form/index.vue`**

```vue
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { NButton, NCard, NCollapse, NCollapseItem, NForm, NFormItem, NInput, NInputNumber, NSelect, NSpace, NSwitch } from 'naive-ui';
import { fetchCreateShopProduct, fetchShopCategories, fetchShopProduct, fetchUpdateShopProduct } from '@/service/api';
import ImageUpload from '@/components/common/ImageUpload.vue';
import MultiImageUpload from '@/components/common/MultiImageUpload.vue';

defineOptions({ name: 'ShopProductsForm' });

const router = useRouter();
const route = useRoute();
const isEdit = computed(() => !!route.params.id);
const loading = ref(false);

const categoryOptions = ref<{ label: string; value: string }[]>([]);

const form = ref({
  name: '',
  shop_category_key: null as string | null,
  subtitle: '',
  price: 0,
  original_price: null as number | null,
  main_image: '',
  images: [] as string[],
  detail_desc: '',
  stock: 0,
  tag: '',
  is_available: 1,
  sort_order: 0,
});

onMounted(async () => {
  const catRes = await fetchShopCategories();
  if (!catRes.error && catRes.data) {
    categoryOptions.value = catRes.data.map(c => ({ label: c.name, value: c.key }));
  }
  if (isEdit.value) {
    loading.value = true;
    const { data, error } = await fetchShopProduct(Number(route.params.id));
    if (!error && data) {
      form.value = {
        name: data.name || '',
        shop_category_key: data.shop_category_key || null,
        subtitle: data.subtitle || '',
        price: parseFloat(data.price) || 0,
        original_price: data.original_price != null ? parseFloat(data.original_price) : null,
        main_image: data.main_image || '',
        images: Array.isArray(data.images) ? data.images : [],
        detail_desc: data.detail_desc || '',
        stock: data.stock ?? 0,
        tag: data.tag || '',
        is_available: data.is_available,
        sort_order: data.sort_order ?? 0,
      };
    }
    loading.value = false;
  }
});

async function handleSubmit() {
  if (!form.value.name) {
    window.$message?.warning('请填写商品名称');
    return;
  }
  loading.value = true;
  const payload = { ...form.value };
  if (!payload.main_image && payload.images.length) {
    payload.main_image = payload.images[0];
  }
  if (isEdit.value) {
    const { error } = await fetchUpdateShopProduct(Number(route.params.id), payload);
    if (!error) {
      window.$message?.success('商品已更新');
      router.push('/shop/products');
    }
  } else {
    const { error } = await fetchCreateShopProduct(payload);
    if (!error) {
      window.$message?.success('商品已创建');
      router.push('/shop/products');
    }
  }
  loading.value = false;
}
</script>

<template>
  <NCard :title="isEdit ? '编辑商城商品' : '新建商城商品'" :bordered="false" class="card-wrapper">
    <template #header-extra>
      <NSpace>
        <NButton @click="router.push('/shop/products')">返回</NButton>
        <NButton type="primary" :loading="loading" @click="handleSubmit">
          {{ isEdit ? '保存修改' : '创建商品' }}
        </NButton>
      </NSpace>
    </template>
    <NForm :model="form" label-placement="top" :style="{ maxWidth: '680px' }">
      <NFormItem label="商品名称" required>
        <NInput v-model:value="form.name" placeholder="例：联名帆布袋" />
      </NFormItem>
      <NFormItem label="副标题">
        <NInput v-model:value="form.subtitle" placeholder="一句话卖点" />
      </NFormItem>
      <NFormItem label="分类">
        <NSelect v-model:value="form.shop_category_key" :options="categoryOptions" clearable style="width:200px" />
      </NFormItem>
      <NFormItem label="售价 (元)" required>
        <NInputNumber v-model:value="form.price" :min="0" :step="0.01" style="width:100%" />
      </NFormItem>
      <NFormItem label="原价 (元，划线价，可空)">
        <NInputNumber v-model:value="form.original_price" :min="0" :step="0.01" clearable style="width:100%" />
      </NFormItem>
      <NFormItem label="主图">
        <ImageUpload v-model="form.main_image" :width="160" :height="160" />
        <NCollapse style="margin-top:8px;width:100%">
          <NCollapseItem title="或手动输入主图 URL" name="url">
            <NInput v-model:value="form.main_image" placeholder="https://..." />
          </NCollapseItem>
        </NCollapse>
      </NFormItem>
      <NFormItem label="详情轮播图">
        <MultiImageUpload v-model="form.images" :width="120" :height="120" :max="6" />
      </NFormItem>
      <NFormItem label="角标文案">
        <NInput v-model:value="form.tag" placeholder="例：新品 / 热卖" style="width:200px" />
      </NFormItem>
      <NFormItem label="库存">
        <NInputNumber v-model:value="form.stock" :min="0" style="width:100%" />
      </NFormItem>
      <NFormItem label="详情描述">
        <NInput v-model:value="form.detail_desc" type="textarea" placeholder="商品详细描述" :autosize="{ minRows: 3 }" />
      </NFormItem>
      <NFormItem label="排序">
        <NInputNumber v-model:value="form.sort_order" :min="0" style="width:100%" />
      </NFormItem>
      <NFormItem label="上架">
        <NSwitch :value="!!form.is_available" @update:value="(v: boolean) => (form.is_available = v ? 1 : 0)" />
      </NFormItem>
    </NForm>
  </NCard>
</template>

<style scoped></style>
```

- [ ] **Step 3: 新建 `views/shop/categories/index.vue`**

```vue
<script setup lang="ts">
import { h, onMounted, reactive, ref } from 'vue';
import { NButton, NCard, NDataTable, NForm, NFormItem, NIcon, NImage, NInput, NInputNumber, NModal, NSpace, NSwitch, useDialog } from 'naive-ui';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@vicons/antd';
import type { DataTableColumns } from 'naive-ui';
import { type AdminShopCategory, fetchCreateShopCategory, fetchDeleteShopCategory, fetchShopCategories, fetchUpdateShopCategory } from '@/service/api';
import ImageUpload from '@/components/common/ImageUpload.vue';

defineOptions({ name: 'ShopCategories' });

const dialog = useDialog();
const categories = ref<AdminShopCategory[]>([]);
const loading = ref(false);

const showModal = ref(false);
const isEdit = ref(false);
const submitting = ref(false);
const form = reactive({
  key: '',
  name: '',
  icon: '',
  sortOrder: 0,
  isActive: true,
});

function resetForm() {
  form.key = '';
  form.name = '';
  form.icon = '';
  form.sortOrder = 0;
  form.isActive = true;
}

function openCreate() {
  isEdit.value = false;
  resetForm();
  showModal.value = true;
}

function openEdit(row: AdminShopCategory) {
  isEdit.value = true;
  form.key = row.key;
  form.name = row.name;
  form.icon = row.icon || '';
  form.sortOrder = row.sort_order || 0;
  form.isActive = !!row.is_active;
  showModal.value = true;
}

const columns: DataTableColumns<AdminShopCategory> = [
  { title: '排序', key: 'sort_order', width: 60, align: 'center' },
  { title: '标识 (key)', key: 'key', width: 120 },
  { title: '名称', key: 'name', width: 140 },
  {
    title: '图标', key: 'icon', width: 70,
    render(row) {
      return row.icon
        ? h(NImage, { src: row.icon, width: 40, height: 40, style: { borderRadius: '6px', objectFit: 'cover' } })
        : '—';
    }
  },
  {
    title: '状态', key: 'is_active', width: 80,
    render(row) {
      return h(NSwitch, {
        value: !!row.is_active,
        onUpdateValue: (val: boolean) => handleToggle(row, val),
      });
    }
  },
  {
    title: '操作', key: 'actions', width: 100,
    render(row) {
      return h(NSpace, null, {
        default: () => [
          h(NButton, { size: 'small', quaternary: true, onClick: () => openEdit(row) }, { icon: () => h(NIcon, null, () => h(EditOutlined)) }),
          h(NButton, { size: 'small', quaternary: true, type: 'error', onClick: () => handleDelete(row) }, { icon: () => h(NIcon, null, () => h(DeleteOutlined)) }),
        ]
      });
    }
  },
];

async function loadCategories() {
  loading.value = true;
  const { data, error } = await fetchShopCategories();
  if (!error && data) categories.value = data;
  loading.value = false;
}

async function handleToggle(row: AdminShopCategory, val: boolean) {
  const prev = row.is_active;
  row.is_active = val ? 1 : 0;
  const { error } = await fetchUpdateShopCategory(row.key, { isActive: val });
  if (error) {
    row.is_active = prev;
    return;
  }
  window.$message?.success(val ? '已启用' : '已禁用');
}

async function handleSubmit() {
  if (!isEdit.value && !/^[a-z0-9_]+$/.test(form.key)) {
    window.$message?.warning('分类标识只能含小写字母、数字、下划线');
    return;
  }
  if (!form.name.trim()) {
    window.$message?.warning('请填写分类名称');
    return;
  }
  submitting.value = true;
  const payload = { name: form.name.trim(), icon: form.icon, sortOrder: form.sortOrder, isActive: form.isActive };
  if (isEdit.value) {
    const { error } = await fetchUpdateShopCategory(form.key, payload);
    if (!error) {
      window.$message?.success('分类已更新');
      showModal.value = false;
      loadCategories();
    }
  } else {
    const { error } = await fetchCreateShopCategory({ key: form.key, ...payload });
    if (!error) {
      window.$message?.success('分类已创建');
      showModal.value = false;
      loadCategories();
    }
  }
  submitting.value = false;
}

function handleDelete(row: AdminShopCategory) {
  dialog.warning({
    title: '确认删除',
    content: `确定删除分类「${row.name}」？`,
    positiveText: '确认删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      const { error } = await fetchDeleteShopCategory(row.key);
      if (!error) {
        window.$message?.success('分类已删除');
        loadCategories();
      }
      // 后端拒绝(分类下有商品)时,请求层会自动 toast 后端消息
    },
  });
}

onMounted(() => { loadCategories(); });
</script>

<template>
  <NCard title="商城分类" :bordered="false" class="card-wrapper">
    <template #header-extra>
      <NButton type="primary" @click="openCreate">
        <template #icon><NIcon><PlusOutlined /></NIcon></template>
        新建分类
      </NButton>
    </template>
    <NDataTable :columns="columns" :data="categories" :loading="loading" :row-key="(r: AdminShopCategory) => r.key" />

    <NModal v-model:show="showModal" preset="card" :title="isEdit ? '编辑分类' : '新建分类'" style="width:480px">
      <NForm :model="form" label-placement="top">
        <NFormItem label="分类标识 (key)" required>
          <NInput v-model:value="form.key" :disabled="isEdit" placeholder="小写字母/数字/下划线，例：featured" />
        </NFormItem>
        <NFormItem label="分类名称" required>
          <NInput v-model:value="form.name" placeholder="例：精选好物" />
        </NFormItem>
        <NFormItem label="图标">
          <ImageUpload v-model="form.icon" :width="120" :height="120" />
        </NFormItem>
        <NFormItem label="排序">
          <NInputNumber v-model:value="form.sortOrder" :min="0" style="width:100%" />
        </NFormItem>
        <NFormItem label="启用">
          <NSwitch v-model:value="form.isActive" />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showModal = false">取消</NButton>
          <NButton type="primary" :loading="submitting" @click="handleSubmit">{{ isEdit ? '保存' : '创建' }}</NButton>
        </NSpace>
      </template>
    </NModal>
  </NCard>
</template>

<style scoped></style>
```

- [ ] **Step 4: 在 `router/routes/index.ts` 的 `products` 块之后插入 `shop` 多级路由**

在 `products`（`:137-188`）的闭合 `},` 之后、`orders` 块之前插入：

```ts
  {
    name: 'shop',
    path: '/shop',
    component: 'layout.base',
    meta: {
      title: '会员商城',
      i18nKey: 'route.shop',
      icon: 'mdi:storefront',
      order: 2.5,
    },
    children: [
      {
        name: 'shop_products_list',
        path: '/shop/products',
        component: 'view.shop_products_list',
        meta: {
          title: '商城商品',
          i18nKey: 'route.shop_products_list',
        },
      },
      {
        name: 'shop_categories',
        path: '/shop/categories',
        component: 'view.shop_categories',
        meta: {
          title: '商城分类',
          i18nKey: 'route.shop_categories',
        },
      },
      {
        name: 'shop_products_create',
        path: '/shop/products/create',
        component: 'view.shop_products_form',
        meta: {
          title: '新建商品',
          i18nKey: 'route.shop_products_create',
          hideInMenu: true,
        },
      },
      {
        name: 'shop_products_edit',
        path: '/shop/products/:id/edit',
        component: 'view.shop_products_form',
        props: true,
        meta: {
          title: '编辑商品',
          i18nKey: 'route.shop_products_edit',
          hideInMenu: true,
        },
      },
    ],
  },
```

- [ ] **Step 5: i18n route 段加键**

`src/locales/langs/zh-cn.ts` 的 `route` 对象内（与 `products` 等同级）追加：
```ts
      shop: '会员商城',
      shop_products_list: '商城商品',
      shop_products_form: '商品表单',
      shop_products_create: '新建商品',
      shop_products_edit: '编辑商品',
      shop_categories: '商城分类',
```

`src/locales/langs/en-us.ts` 的 `route` 对象内追加：
```ts
      shop: 'Shop',
      shop_products_list: 'Shop Products',
      shop_products_form: 'Product Form',
      shop_products_create: 'New Product',
      shop_products_edit: 'Edit Product',
      shop_categories: 'Shop Categories',
```

> `shop_products_form` 也加键：elegant-router 会从 `views/shop/products/form/` 自动生成同名路由，补键避免控制台 i18n 缺失告警（与现有 `products_form` 一致）。

- [ ] **Step 6: 生成路由类型并构建**

Run（soybean-admin-temp 目录）:
```bash
$env:PATH = "C:\Program Files\nodejs;" + $env:PATH
pnpm gen-route
pnpm build
```
Expected:
- `gen-route` 刷新 `elegant/imports.ts`（含 `shop_products_list`/`shop_products_form`/`shop_categories` 三个 `view.*` 懒加载映射）、`elegant/routes.ts`、`transform.ts`、`typings/elegant-router.d.ts`，无报错。
- `pnpm build` 成功生成 `dist/`，无 TS / 编译错误。

- [ ] **Step 7: dev 点测（菜单无重复）**

Run: `pnpm dev`，浏览器登录后台。
Expected: 左侧菜单出现"会员商城"（图标 storefront，位于"商品管理"与"订单管理"之间），展开有"商城商品""商城分类"两项，**无重复菜单**；进入"商城商品"可列表/新建/编辑/删除/上下架；进入"商城分类"可弹窗 CRUD + 图片图标上传。

- [ ] **Step 8: Commit**

```bash
git add soybean-admin-temp/src/views/shop soybean-admin-temp/src/router soybean-admin-temp/src/typings/elegant-router.d.ts soybean-admin-temp/src/locales/langs/zh-cn.ts soybean-admin-temp/src/locales/langs/en-us.ts
git commit -m "feat: v1.4.0 admin shop pages (products list/form + categories) + route + i18n"
```

---

## Task 7: 小程序主页商城 tab 改造（main.js / tpl-shop.wxml / main.wxss）

**Files:**
- Modify: `miniprogram/pages/main/main.js`
- Modify: `miniprogram/pages/main/tpl-shop.wxml`
- Modify: `miniprogram/pages/main/main.wxss`（追加 `.shop-fav-btn` / `.shop-cat-icon`）

**Interfaces:**
- Consumes: Task 3 公开接口 `/shop/products`、`/shop/categories`、`/shop/favorites/:id`；`utils/api` 的 `api.{get,post,del}`、`fixImageUrl`。
- Produces: 商城 tab 读独立 `/shop/*` 数据；商品卡用收藏心形替代购物车步进器；点商品 `wx.navigateTo` 到 `shop-detail`。

> **核心解耦**：当前商城数据派生自点单 `/products`（`fetchProducts` 的 `:137-139`），并在 `syncCart`（`:200-203`）同步购物车数量。本任务把商城数据切换到独立 `fetchShopData()`，并移除商城购物车逻辑（商城商品不入购物车）。

- [ ] **Step 1: `main.js:7` 移除 `SHOP_CATEGORIES` 导入**

```js
// 旧：
const { CATEGORY_ICON_MAP, dietaryRestrictions, SHOP_CATEGORIES } = require('../../utils/data');
// 新：
const { CATEGORY_ICON_MAP, dietaryRestrictions } = require('../../utils/data');
```

- [ ] **Step 2: `main.js:46-48` data 初值改空 + 加 `shopLoaded`**

```js
// 旧：
    shopBanners: [], shopCategories: SHOP_CATEGORIES,
    shopActiveCat: 'all', shopActiveCatName: '精选好物',
    shopProducts: [], shopFilteredProducts: [],
// 新：
    shopBanners: [], shopCategories: [],
    shopActiveCat: 'all', shopActiveCatName: '精选好物',
    shopProducts: [], shopFilteredProducts: [], shopLoaded: false,
```

- [ ] **Step 3: `main.js:137-139` 从 `fetchProducts` 删除商城派生三行**

删除 `fetchProducts` setData 中的：
```js
          shopProducts: products,
          shopFilteredProducts: products,
          shopBanners: banners,
```
（保留 `productsLoaded: true,` 作为该 setData 最后一项。）

- [ ] **Step 4: 在 `fetchProducts` 之后（`:143` `},` 后）新增 `fetchShopData()`**

```js
  fetchShopData() {
    Promise.all([
      api.get('/shop/products'),
      api.get('/shop/categories'),
    ]).then(([prodRes, catRes]) => {
      if (prodRes.code === 0) {
        const products = (prodRes.data || []).map(p => ({
          ...p,
          main_image: fixImageUrl(p.main_image),
        }));
        const withImg = products.filter(p => p.main_image);
        const banners = withImg.slice(0, 3).map((p, i) => ({
          id: i,
          image: p.main_image,
          title: p.name,
          subtitle: p.subtitle || '精选好物，新鲜上架',
        }));
        const cats = [
          { key: 'all', name: '精选好物', icon: '' },
          ...(catRes && catRes.code === 0 ? (catRes.data || []) : []).map(c => ({
            ...c,
            icon: fixImageUrl(c.icon),
          })),
        ];
        const { shopActiveCat } = this.data;
        const filtered = shopActiveCat === 'all'
          ? products
          : products.filter(p => p.shop_category_key === shopActiveCat);
        this.setData({
          shopProducts: products,
          shopFilteredProducts: filtered,
          shopBanners: banners,
          shopCategories: cats,
          shopLoaded: true,
        });
      }
    }).catch(() => {});
  },
```

- [ ] **Step 5: `main.js:64-67` onLoad 加载商城数据**

在 `onLoad()` 中 `this.fetchProducts();` 之后加一行：
```js
    this.fetchShopData();
```

- [ ] **Step 6: 切到商城 tab 时刷新（懒加载 + 返回刷新收藏态）**

在两处设置 `currentTab` 的处理器中（`:183-185` 与 `:188-190`），在 `if (index === 1) this.fetchOrders();`（resp. `idx`）之后各加：
```js
    if (index === 2 && !this.data.shopLoaded) this.fetchShopData();   // :183-185 处用 index
```
```js
    if (idx === 2 && !this.data.shopLoaded) this.fetchShopData();     // :188-190 处用 idx
```
并在 `onShow()`（`:72`）的 `if (this._ready) { ... }` 块内、`this.syncCart();` 之后加（从详情页返回时刷新收藏徽标）：
```js
      if (this.data.currentTab === 2 && this.data.shopLoaded) this.fetchShopData();
```

- [ ] **Step 7: `main.js:200-203` syncCart 移除商城同步**

```js
// 旧（:200-203 三处商城相关 + setData 含 shop 字段）：
    // Also sync shop data
    const updatedShopProducts = this.data.shopProducts.map(p => ({ ...p, quantity: cart[p.id] ? cart[p.id].quantity : 0 }));
    const shopFiltered = this.data.shopActiveCat === 'all' ? updatedShopProducts : updatedShopProducts.filter(p => p.category === this.data.shopActiveCat || (p.category_key && p.category_key === this.data.shopActiveCat));
    this.setData({ products: updatedProducts, filteredProducts: filtered, shopProducts: updatedShopProducts, shopFilteredProducts: shopFiltered, cartItems: Object.values(cart), cartCount: app.globalData.cartCount, cartTotal: app.globalData.cartTotal });
// 新（删两行 shop，setData 去掉 shop 字段）：
    this.setData({ products: updatedProducts, filteredProducts: filtered, cartItems: Object.values(cart), cartCount: app.globalData.cartCount, cartTotal: app.globalData.cartTotal });
```

- [ ] **Step 8: `main.js:620-645` 重写商城分类/交互处理器**

整段替换 `onShopCategory` / `onShopAddToCart` / `onShopDecrease` / `onShopBannerTap` / `onShopProductTap` / `syncShopCart`（`:620-645`）为：

```js
  onShopCategory(e) {
    const { key } = e.currentTarget.dataset;
    const cat = this.data.shopCategories.find(c => c.key === key);
    const products = this.data.shopProducts;
    const filtered = key === 'all' ? products : products.filter(p => p.shop_category_key === key);
    this.setData({ shopActiveCat: key, shopActiveCatName: cat ? cat.name : '精选好物', shopFilteredProducts: filtered });
  },
  onShopBannerTap() { wx.showToast({ title: '促销活动即将上线', icon: 'none' }); },
  onShopProductTap(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({ url: '/pages/shop-detail/shop-detail?id=' + id });
  },
  onShopToggleFav(e) {
    const { id } = e.currentTarget.dataset;
    const target = this.data.shopProducts.find(p => p.id === id);
    if (!target) return;
    const next = !target.isFavorited;
    const apply = (val) => (list) => list.map(p => (p.id === id ? { ...p, isFavorited: val } : p));
    this.setData({
      shopProducts: apply(next)(this.data.shopProducts),
      shopFilteredProducts: apply(next)(this.data.shopFilteredProducts),
    });
    const req = next ? api.post('/shop/favorites/' + id) : api.del('/shop/favorites/' + id);
    req.then(res => {
      if (!res || res.code !== 0) throw new Error('fav failed');
    }).catch(() => {
      this.setData({
        shopProducts: apply(!next)(this.data.shopProducts),
        shopFilteredProducts: apply(!next)(this.data.shopFilteredProducts),
      });
      wx.showToast({ title: '操作失败', icon: 'none' });
    });
  },
```
（`onShopAddToCart`/`onShopDecrease`/`syncShopCart` 删除——商城不再使用购物车。）

- [ ] **Step 9: `main.js:668` onMenuItem 收藏入口改向**

```js
// 旧：
      address: '/pages/address/address', favorites: '/pages/address/address',
// 新：
      address: '/pages/address/address', favorites: '/pages/favorites/favorites',
```

- [ ] **Step 10: 重写 `tpl-shop.wxml`（整文件覆盖）**

```html
<!-- 商城页 — 会员商城（黏土风；与 pages/shop 同步。商品不入购物车，可收藏，点卡片进详情） -->
<scroll-view scroll-y class="shop-scroll" enhanced show-scrollbar="{{false}}" style="height: {{scrollViewHeight}}px;">
  <view class="shop-scroll-inner">
    <!-- 顶部 Hero（促销 Banner） -->
    <view class="shop-hero" wx:if="{{shopBanners.length > 0}}">
      <swiper class="shop-hero-swiper" autoplay interval="4000" circular indicator-dots indicator-color="rgba(255,255,255,0.35)" indicator-active-color="#C0563A">
        <swiper-item wx:for="{{shopBanners}}" wx:key="id">
          <view class="shop-hero-slide" bindtap="onShopBannerTap" data-id="{{item.id}}">
            <image class="shop-hero-img" src="{{item.image}}" mode="aspectFill"></image>
            <view class="shop-hero-overlay">
              <text class="shop-hero-title">{{item.title}}</text>
              <text class="shop-hero-sub">{{item.subtitle}}</text>
            </view>
          </view>
        </swiper-item>
      </swiper>
    </view>

    <!-- 分类 Tab（下划线式横向滚动；图标用图片） -->
    <scroll-view scroll-x enhanced show-scrollbar="{{false}}" class="shop-cat-tabs">
      <view
        wx:for="{{shopCategories}}"
        wx:key="key"
        class="shop-cat-tab {{shopActiveCat === item.key ? 'active' : ''}}"
        bindtap="onShopCategory"
        data-key="{{item.key}}"
      >
        <image wx:if="{{item.icon}}" class="shop-cat-icon" src="{{item.icon}}" mode="aspectFill"></image>
        <text>{{item.name}}</text>
      </view>
    </scroll-view>

    <!-- 节标题 -->
    <view class="shop-section-header">
      <text class="shop-section-title">{{shopActiveCat === 'all' ? '精选好物' : shopActiveCatName}}</text>
      <text class="shop-section-count">{{shopFilteredProducts.length}}件</text>
    </view>

    <!-- 商品列表：第 1 件 = Featured 大图卡，其余 = 横向列表卡 -->
    <view class="shop-list" wx:if="{{shopFilteredProducts.length > 0}}">
      <block wx:for="{{shopFilteredProducts}}" wx:key="id">
        <!-- Featured -->
        <view wx:if="{{index === 0}}" class="shop-feat-card" bindtap="onShopProductTap" data-id="{{item.id}}">
          <view class="shop-feat-imgwrap">
            <image class="shop-feat-img" src="{{item.main_image}}" mode="aspectFill"></image>
            <view class="shop-feat-badge" wx:if="{{item.tag}}"><text>{{item.tag}}</text></view>
          </view>
          <view class="shop-feat-body">
            <text class="shop-feat-name">{{item.name}}</text>
            <text class="shop-feat-desc">{{item.subtitle || '精选好物，新鲜上架'}}</text>
            <view class="shop-feat-divider"></view>
            <view class="shop-feat-bottom">
              <view class="shop-price-row">
                <text class="shop-price-sym">¥</text>
                <text class="shop-price">{{item.price}}</text>
                <text class="shop-original" wx:if="{{item.original_price}}">¥{{item.original_price}}</text>
              </view>
              <view class="shop-fav-btn {{item.isFavorited ? 'active' : ''}}" catchtap="onShopToggleFav" data-id="{{item.id}}">
                <text class="shop-fav-icon">{{item.isFavorited ? '♥' : '♡'}}</text>
              </view>
            </view>
          </view>
        </view>

        <!-- 横向列表卡 -->
        <view wx:else class="shop-list-card" bindtap="onShopProductTap" data-id="{{item.id}}">
          <image class="shop-list-img" src="{{item.main_image}}" mode="aspectFill"></image>
          <view class="shop-list-body">
            <text class="shop-list-name">{{item.name}}</text>
            <text class="shop-list-desc">{{item.subtitle || '精选好物，新鲜上架'}}</text>
            <view class="shop-list-bottom">
              <view class="shop-price-row">
                <text class="shop-price-sym">¥</text>
                <text class="shop-price">{{item.price}}</text>
                <text class="shop-original" wx:if="{{item.original_price}}">¥{{item.original_price}}</text>
              </view>
              <view class="shop-fav-btn {{item.isFavorited ? 'active' : ''}}" catchtap="onShopToggleFav" data-id="{{item.id}}">
                <text class="shop-fav-icon">{{item.isFavorited ? '♥' : '♡'}}</text>
              </view>
            </view>
          </view>
        </view>
      </block>

      <view class="shop-list-end"><text class="shop-list-end-text">没有更多商品了</text></view>
    </view>

    <!-- 空状态 -->
    <view class="shop-empty" wx:else>
      <text class="shop-empty-icon">🛍️</text>
      <text class="shop-empty-text">暂无商品</text>
      <text class="shop-empty-sub">敬请期待更多好物上架</text>
    </view>

    <view style="height: calc(140rpx + env(safe-area-inset-bottom))"></view>
  </view>
</scroll-view>
```

- [ ] **Step 11: `main.wxss` 追加 `.shop-fav-btn` / `.shop-cat-icon`**

在商城 CSS 块（`.shop-add-btn.has-qty`，约 `:573`）之后追加（旧 `.shop-add-btn`/`.shop-mini-*` 现已不用，可保留不动）：

```css
/* 商城收藏按钮（替代购物车步进器） */
.shop-fav-btn { width: 60rpx; height: 60rpx; border-radius: var(--radius-full); background: var(--glass-bg-card); display: flex; align-items: center; justify-content: center; box-shadow: var(--glass-shadow-card); border: var(--glass-border-subtle); flex-shrink: 0; transition: all 0.2s; }
.shop-fav-btn:active { transform: scale(0.9); }
.shop-fav-btn.active { background: var(--glass-bg-primary-light); border: var(--glass-border-colored); }
.shop-fav-icon { font-size: 34rpx; line-height: 1; color: var(--color-on-surface-variant); }
.shop-fav-btn.active .shop-fav-icon { color: var(--color-primary); }
/* 分类图标改用图片（替代 emoji） */
.shop-cat-icon { width: 36rpx; height: 36rpx; border-radius: var(--radius-sm); }
```

- [ ] **Step 12: WeChat DevTools 验证**

打开 `miniprogram/`，编译运行：切到"商城" tab。
Expected:
- 商品来自 `/shop/products`（与点单 tab 不同源）；分类 tab 显示图片图标 + 名称；
- 商品卡右下为收藏心形（非 + 步进器）；点心形空心↔实心切换、调用 `/shop/favorites/:id`；
- 点卡片 `wx.navigateTo` 到 `/pages/shop-detail/...`（详情页在 Task 9 创建，届时联调通过；此步先确认跳转 URL 正确触发）。

- [ ] **Step 13: Commit**

```bash
git add miniprogram/pages/main/main.js miniprogram/pages/main/tpl-shop.wxml miniprogram/pages/main/main.wxss
git commit -m "feat: v1.4.0 miniprogram main shop tab -> /shop API + favorites (no cart)"
```

---

## Task 8: 小程序独立商城页同步（pages/shop）

**Files:**
- Modify: `miniprogram/pages/shop/shop.js`
- Modify: `miniprogram/pages/shop/shop.wxml`
- Modify: `miniprogram/pages/shop/shop.wxss`（追加 `.shop-fav-btn` / `.shop-cat-icon`）

**Interfaces:**
- Consumes: 同 Task 7 的 `/shop/*` 接口与 `api.{get,post,del}` / `fixImageUrl`。
- Produces: 独立商城页与主页商城 tab 行为一致（读 `/shop`、收藏心形、跳详情）。

> 该页虽与主页商城 tab 重复，但已注册可达，按"重复页面逻辑须同步"规则一并改造，避免两处行为分叉。**不新增/不改 `shop.json`**（已存在）。

- [ ] **Step 1: 重写 `shop.js`（整文件覆盖）**

```js
// pages/shop/shop.js — 会员商城（独立页，与 pages/main 商城 tab 同步）
const { api, fixImageUrl } = require('../../utils/api');
const { getSwiperLayout } = require('../../utils/layout');

Page({
  data: {
    statusBarHeight: 44,
    topBarTotalHeight: 80,
    scrollViewHeight: 0,
    shopBanners: [],
    shopCategories: [],
    shopActiveCat: 'all',
    shopActiveCatName: '精选好物',
    shopProducts: [],
    shopFilteredProducts: [],
    loading: true,
  },

  onLoad() {
    this.setData(getSwiperLayout());
    this.fetchShopData();
  },

  onShow() {
    const tabBar = this.getTabBar && this.getTabBar();
    if (tabBar && tabBar.data.selected !== 2) {
      tabBar.setData({ selected: 2 });
    }
    // 已加载过则刷新收藏态（从详情页返回时）
    if (this.data.shopProducts.length) this.fetchShopData();
  },

  fetchShopData() {
    Promise.all([
      api.get('/shop/products'),
      api.get('/shop/categories'),
    ]).then(([prodRes, catRes]) => {
      if (prodRes.code === 0) {
        const products = (prodRes.data || []).map(p => ({
          ...p,
          main_image: fixImageUrl(p.main_image),
        }));
        const withImg = products.filter(p => p.main_image);
        const banners = withImg.slice(0, 3).map((p, i) => ({
          id: i,
          image: p.main_image,
          title: p.name,
          subtitle: p.subtitle || '精选好物，新鲜上架',
        }));
        const cats = [
          { key: 'all', name: '精选好物', icon: '' },
          ...(catRes && catRes.code === 0 ? (catRes.data || []) : []).map(c => ({
            ...c,
            icon: fixImageUrl(c.icon),
          })),
        ];
        const { shopActiveCat } = this.data;
        const filtered = shopActiveCat === 'all'
          ? products
          : products.filter(p => p.shop_category_key === shopActiveCat);
        this.setData({
          shopProducts: products,
          shopFilteredProducts: filtered,
          shopBanners: banners,
          shopCategories: cats,
          loading: false,
        });
      } else {
        this.setData({ loading: false });
      }
    }).catch(() => {
      this.setData({ loading: false });
    });
  },

  onShopCategory(e) {
    const { key } = e.currentTarget.dataset;
    const cat = this.data.shopCategories.find(c => c.key === key);
    const products = this.data.shopProducts;
    const filtered = key === 'all' ? products : products.filter(p => p.shop_category_key === key);
    this.setData({ shopActiveCat: key, shopActiveCatName: cat ? cat.name : '精选好物', shopFilteredProducts: filtered });
  },

  onShopBannerTap() { wx.showToast({ title: '促销活动即将上线', icon: 'none' }); },

  onShopProductTap(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({ url: '/pages/shop-detail/shop-detail?id=' + id });
  },

  onShopToggleFav(e) {
    const { id } = e.currentTarget.dataset;
    const target = this.data.shopProducts.find(p => p.id === id);
    if (!target) return;
    const next = !target.isFavorited;
    const apply = (val) => (list) => list.map(p => (p.id === id ? { ...p, isFavorited: val } : p));
    this.setData({
      shopProducts: apply(next)(this.data.shopProducts),
      shopFilteredProducts: apply(next)(this.data.shopFilteredProducts),
    });
    const req = next ? api.post('/shop/favorites/' + id) : api.del('/shop/favorites/' + id);
    req.then(res => {
      if (!res || res.code !== 0) throw new Error('fav failed');
    }).catch(() => {
      this.setData({
        shopProducts: apply(!next)(this.data.shopProducts),
        shopFilteredProducts: apply(!next)(this.data.shopFilteredProducts),
      });
      wx.showToast({ title: '操作失败', icon: 'none' });
    });
  },
});
```

- [ ] **Step 2: 重写 `shop.wxml`（整文件覆盖）**

```html
<!-- pages/shop/shop.wxml — 会员商城（黏土风；与 pages/main 商城 tab 同步。商品不入购物车，可收藏） -->
<view class="shop-page" style="padding-top: {{topBarTotalHeight}}px">
  <view class="shop-top-bar" style="padding-top: {{statusBarHeight}}px;">
    <text class="shop-top-title">会员商城</text>
  </view>

  <scroll-view scroll-y class="shop-scroll" enhanced show-scrollbar="{{false}}" style="height: {{scrollViewHeight}}px;">
    <view class="shop-scroll-inner">
      <view class="shop-hero" wx:if="{{shopBanners.length > 0}}">
        <swiper class="shop-hero-swiper" autoplay interval="4000" circular indicator-dots indicator-color="rgba(255,255,255,0.35)" indicator-active-color="#C0563A">
          <swiper-item wx:for="{{shopBanners}}" wx:key="id">
            <view class="shop-hero-slide" bindtap="onShopBannerTap" data-id="{{item.id}}">
              <image class="shop-hero-img" src="{{item.image}}" mode="aspectFill"></image>
              <view class="shop-hero-overlay">
                <text class="shop-hero-title">{{item.title}}</text>
                <text class="shop-hero-sub">{{item.subtitle}}</text>
              </view>
            </view>
          </swiper-item>
        </swiper>
      </view>

      <scroll-view scroll-x enhanced show-scrollbar="{{false}}" class="shop-cat-tabs">
        <view
          wx:for="{{shopCategories}}"
          wx:key="key"
          class="shop-cat-tab {{shopActiveCat === item.key ? 'active' : ''}}"
          bindtap="onShopCategory"
          data-key="{{item.key}}"
        >
          <image wx:if="{{item.icon}}" class="shop-cat-icon" src="{{item.icon}}" mode="aspectFill"></image>
          <text>{{item.name}}</text>
        </view>
      </scroll-view>

      <view class="shop-section-header">
        <text class="shop-section-title">{{shopActiveCat === 'all' ? '精选好物' : shopActiveCatName}}</text>
        <text class="shop-section-count">{{shopFilteredProducts.length}}件</text>
      </view>

      <view class="shop-list" wx:if="{{shopFilteredProducts.length > 0}}">
        <block wx:for="{{shopFilteredProducts}}" wx:key="id">
          <view wx:if="{{index === 0}}" class="shop-feat-card" bindtap="onShopProductTap" data-id="{{item.id}}">
            <view class="shop-feat-imgwrap">
              <image class="shop-feat-img" src="{{item.main_image}}" mode="aspectFill"></image>
              <view class="shop-feat-badge" wx:if="{{item.tag}}"><text>{{item.tag}}</text></view>
            </view>
            <view class="shop-feat-body">
              <text class="shop-feat-name">{{item.name}}</text>
              <text class="shop-feat-desc">{{item.subtitle || '精选好物，新鲜上架'}}</text>
              <view class="shop-feat-divider"></view>
              <view class="shop-feat-bottom">
                <view class="shop-price-row">
                  <text class="shop-price-sym">¥</text>
                  <text class="shop-price">{{item.price}}</text>
                  <text class="shop-original" wx:if="{{item.original_price}}">¥{{item.original_price}}</text>
                </view>
                <view class="shop-fav-btn {{item.isFavorited ? 'active' : ''}}" catchtap="onShopToggleFav" data-id="{{item.id}}">
                  <text class="shop-fav-icon">{{item.isFavorited ? '♥' : '♡'}}</text>
                </view>
              </view>
            </view>
          </view>

          <view wx:else class="shop-list-card" bindtap="onShopProductTap" data-id="{{item.id}}">
            <image class="shop-list-img" src="{{item.main_image}}" mode="aspectFill"></image>
            <view class="shop-list-body">
              <text class="shop-list-name">{{item.name}}</text>
              <text class="shop-list-desc">{{item.subtitle || '精选好物，新鲜上架'}}</text>
              <view class="shop-list-bottom">
                <view class="shop-price-row">
                  <text class="shop-price-sym">¥</text>
                  <text class="shop-price">{{item.price}}</text>
                  <text class="shop-original" wx:if="{{item.original_price}}">¥{{item.original_price}}</text>
                </view>
                <view class="shop-fav-btn {{item.isFavorited ? 'active' : ''}}" catchtap="onShopToggleFav" data-id="{{item.id}}">
                  <text class="shop-fav-icon">{{item.isFavorited ? '♥' : '♡'}}</text>
                </view>
              </view>
            </view>
          </view>
        </block>

        <view class="shop-list-end"><text class="shop-list-end-text">没有更多商品了</text></view>
      </view>

      <view class="shop-empty" wx:else>
        <text class="shop-empty-icon">🛍️</text>
        <text class="shop-empty-text">暂无商品</text>
        <text class="shop-empty-sub">敬请期待更多好物上架</text>
      </view>

      <view style="height: calc(140rpx + env(safe-area-inset-bottom))"></view>
    </view>
  </scroll-view>
</view>
```

- [ ] **Step 3: `shop.wxss` 追加 `.shop-fav-btn` / `.shop-cat-icon`**

在 `.shop-mini-qty`（约 `:164`）之后追加（旧 `.shop-add-btn`/`.shop-mini-*` 保留不动，已不使用）：

```css
/* 商城收藏按钮（替代购物车步进器） */
.shop-fav-btn { width: 60rpx; height: 60rpx; border-radius: var(--radius-full); background: var(--glass-bg-card); display: flex; align-items: center; justify-content: center; box-shadow: var(--glass-shadow-card); border: var(--glass-border-subtle); flex-shrink: 0; transition: all 0.2s; }
.shop-fav-btn:active { transform: scale(0.9); }
.shop-fav-btn.active { background: var(--glass-bg-primary-light); border: var(--glass-border-colored); }
.shop-fav-icon { font-size: 34rpx; line-height: 1; color: var(--color-on-surface-variant); }
.shop-fav-btn.active .shop-fav-icon { color: var(--color-primary); }
/* 分类图标改用图片（替代 emoji） */
.shop-cat-icon { width: 36rpx; height: 36rpx; border-radius: var(--radius-sm); }
```

- [ ] **Step 4: WeChat DevTools 验证**

如该页有入口可达，运行确认与主页商城 tab 行为一致（读 `/shop`、心形收藏、跳详情）。若暂无直接入口，至少编译无报错、`shop.js` 无运行时异常。

- [ ] **Step 5: Commit**

```bash
git add miniprogram/pages/shop/shop.js miniprogram/pages/shop/shop.wxml miniprogram/pages/shop/shop.wxss
git commit -m "feat: v1.4.0 standalone shop page sync -> /shop API + favorites"
```

---

## Task 9: 小程序商品详情页（pages/shop-detail）

**Files:**
- Create: `miniprogram/pages/shop-detail/shop-detail.js`
- Create: `miniprogram/pages/shop-detail/shop-detail.json`
- Create: `miniprogram/pages/shop-detail/shop-detail.wxml`
- Create: `miniprogram/pages/shop-detail/shop-detail.wxss`
- Modify: `miniprogram/app.json`（`pages` 数组追加 `"pages/shop-detail/shop-detail"`）

**Interfaces:**
- Consumes:
  - `GET /shop/products/:id`（Task 3，`optionalAuth`）→ 返回单品对象，含 `id, name, subtitle, price, original_price, stock, sales, tag, main_image, images[], detail_desc, isFavorited`。
  - `POST /shop/favorites/:productId` / `DELETE /shop/favorites/:productId`（Task 3，需登录）。
  - `api.{get,post,del}`、`fixImageUrl`（`utils/api.js`：`api.del(path)` 只收路径；`request` 在 2xx 时 resolve 信封 `{code,data}`，非 2xx 自行弹 toast 并 reject）。
  - `getBackBtnTopBar()`（`utils/layout.js`，**无参**，返回 `{statusBarHeight, topBarTotalHeight}`）。
- Produces: 商城详情页入口（由 Task 7/8 `onShopProductTap` 经 `wx.navigateTo({ url: '/pages/shop-detail/shop-detail?id=' + id })` 进入）。收藏态在用户返回列表时由 Task 8 `onShow` 重新拉取同步。立即购买为 **Phase 2 占位**（toast「下单功能即将上线」），不接支付。

> 详情页是**普通 Page**（非 swiper），用页面原生滚动；顶部返回栏与底部操作栏均 `position: fixed`。**禁止任何 `backdrop-filter`**（见记忆 `theme-reapply-onshow-flicker`：声明即被 resume 重栅格化导致闪烁），固定栏用不透明/半透明底色 + 内阴影做"假玻璃"。主题模块已整体移除（记忆 `theme-module-removed`），外观完全依赖 `app.wxss` 静态暖陶土令牌，**不需要**自加载主题。

- [ ] **Step 1: 新建 `shop-detail.js`**

```js
// pages/shop-detail/shop-detail.js — 会员商城商品详情（不入购物车，可收藏，单独支付 Phase 2）
const { api, fixImageUrl } = require('../../utils/api');
const { getBackBtnTopBar } = require('../../utils/layout');

Page({
  data: {
    statusBarHeight: 44,
    topBarTotalHeight: 80,
    productId: null,
    product: null,
    images: [],
    loading: true,
    favLoading: false,
  },

  onLoad(options) {
    this.setData(getBackBtnTopBar());
    const id = options.id;
    if (!id) {
      wx.showToast({ title: '商品不存在', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 800);
      return;
    }
    this.setData({ productId: id });
    this.fetchDetail();
  },

  fetchDetail() {
    api.get('/shop/products/' + this.data.productId).then(res => {
      if (res.code === 0 && res.data) {
        const p = res.data;
        const imgs = (Array.isArray(p.images) && p.images.length
          ? p.images
          : (p.main_image ? [p.main_image] : [])
        ).map(u => fixImageUrl(u));
        this.setData({
          product: { ...p, main_image: fixImageUrl(p.main_image) },
          images: imgs,
          loading: false,
        });
      } else {
        this.setData({ loading: false });
        wx.showToast({ title: '商品不存在', icon: 'none' });
      }
    }).catch(() => {
      // request 层已对网络/HTTP 错误弹过 toast，这里仅退出 loading
      this.setData({ loading: false });
    });
  },

  onBack() { wx.navigateBack(); },

  onToggleFav() {
    const p = this.data.product;
    if (!p || this.data.favLoading) return;
    const next = !p.isFavorited;
    // 乐观更新
    this.setData({ 'product.isFavorited': next, favLoading: true });
    const req = next
      ? api.post('/shop/favorites/' + p.id)
      : api.del('/shop/favorites/' + p.id);
    req.then(res => {
      if (!res || res.code !== 0) throw new Error('fav failed');
      wx.showToast({ title: next ? '已收藏' : '已取消收藏', icon: 'none' });
    }).catch(() => {
      // 回滚（request 层已弹错误提示）
      this.setData({ 'product.isFavorited': !next });
    }).then(() => {
      this.setData({ favLoading: false });
    });
  },

  // Phase 2：商城单独支付下单（不与点单混合）。当前为占位。
  onBuy() {
    wx.showToast({ title: '下单功能即将上线', icon: 'none' });
  },
});
```

- [ ] **Step 2: 新建 `shop-detail.json`**

```json
{
  "navigationStyle": "custom",
  "navigationBarTitleText": "商品详情",
  "usingComponents": {}
}
```

- [ ] **Step 3: 新建 `shop-detail.wxml`**

```html
<!-- pages/shop-detail/shop-detail.wxml — 商城商品详情（黏土风，无 backdrop-filter；页面原生滚动） -->
<view class="sd-page" style="padding-top: {{topBarTotalHeight}}px">
  <!-- 顶部返回栏（固定） -->
  <view class="sd-top-bar" style="padding-top: {{statusBarHeight}}px;">
    <view class="sd-back-btn" bindtap="onBack"><text class="sd-back-icon">‹</text></view>
    <text class="sd-top-title">商品详情</text>
    <view class="sd-back-btn sd-back-placeholder"></view>
  </view>

  <!-- 内容（依赖页面原生滚动，非 swiper/scroll-view） -->
  <view class="sd-body" wx:if="{{product}}">
    <!-- 图片轮播 -->
    <view class="sd-gallery" wx:if="{{images.length > 0}}">
      <swiper class="sd-swiper" circular="{{images.length > 1}}" indicator-dots="{{images.length > 1}}" indicator-color="rgba(255,255,255,0.4)" indicator-active-color="#C0563A">
        <swiper-item wx:for="{{images}}" wx:key="*this">
          <image class="sd-img" src="{{item}}" mode="aspectFill"></image>
        </swiper-item>
      </swiper>
    </view>

    <!-- 信息卡 -->
    <view class="sd-info card">
      <view class="sd-price-row">
        <text class="sd-price-sym">¥</text>
        <text class="sd-price">{{product.price}}</text>
        <text class="sd-original" wx:if="{{product.original_price}}">¥{{product.original_price}}</text>
        <view class="sd-tag" wx:if="{{product.tag}}"><text>{{product.tag}}</text></view>
      </view>
      <text class="sd-name">{{product.name}}</text>
      <text class="sd-subtitle" wx:if="{{product.subtitle}}">{{product.subtitle}}</text>
      <view class="sd-meta">
        <text class="sd-meta-item">库存 {{product.stock}}</text>
        <text class="sd-meta-item">已售 {{product.sales}}</text>
      </view>
    </view>

    <!-- 商品详情描述 -->
    <view class="sd-desc card" wx:if="{{product.detail_desc}}">
      <text class="sd-desc-title">商品详情</text>
      <text class="sd-desc-text">{{product.detail_desc}}</text>
    </view>

    <!-- 底部固定栏占位 -->
    <view style="height: calc(180rpx + env(safe-area-inset-bottom))"></view>
  </view>

  <!-- 加载态 -->
  <view class="sd-loading" wx:elif="{{loading}}"><text>加载中…</text></view>

  <!-- 底部操作栏（固定）：收藏 + 立即购买（Phase 2 占位） -->
  <view class="sd-bottom-bar" wx:if="{{product}}">
    <view class="sd-fav {{product.isFavorited ? 'active' : ''}}" bindtap="onToggleFav">
      <text class="sd-fav-icon">{{product.isFavorited ? '♥' : '♡'}}</text>
      <text class="sd-fav-label">收藏</text>
    </view>
    <view class="sd-buy-btn" bindtap="onBuy"><text>立即购买</text></view>
  </view>
</view>
```

- [ ] **Step 4: 新建 `shop-detail.wxss`**

> 所有令牌均已对照 `app.wxss` 确认存在：`--glass-bg-nav`/`--glass-bg-card`/`--glass-bg-primary`/`--glass-border-subtle`/`--color-on-surface`/`--color-on-surface-variant`/`--color-primary`/`--color-price`/`--radius-full`/`--font-weight-bold`/`--glass-shadow-button`。**全文无 `backdrop-filter`。**

```css
/* pages/shop-detail/shop-detail.wxss — 商城商品详情（黏土风；无 backdrop-filter） */
.sd-page { min-height: 100vh; box-sizing: border-box; }

/* 顶部返回栏（固定；不透明底 + 内阴影做"假玻璃"，无 backdrop-filter） */
.sd-top-bar {
  position: fixed; top: 0; left: 0; right: 0; z-index: 100;
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 24rpx 20rpx;
  background: var(--glass-bg-nav);
  border-bottom: var(--glass-border-subtle);
  box-shadow: 0 2rpx 16rpx rgba(120, 108, 94, 0.10);
}
.sd-back-btn {
  width: 64rpx; height: 64rpx; border-radius: var(--radius-full);
  background: var(--glass-bg-card); border: var(--glass-border-subtle);
  display: flex; align-items: center; justify-content: center;
}
.sd-back-placeholder { background: transparent; border: none; box-shadow: none; }
.sd-back-icon { font-size: 48rpx; line-height: 1; color: var(--color-on-surface); }
.sd-top-title { font-size: 34rpx; font-weight: var(--font-weight-bold); color: var(--color-on-surface); }

/* 内容 */
.sd-body { padding-bottom: 24rpx; }

/* 图片轮播 */
.sd-gallery { width: 100%; }
.sd-swiper { width: 100%; height: 600rpx; }
.sd-img { width: 100%; height: 100%; }

/* 信息卡（复用 app.wxss .card 工具类） */
.sd-info { margin: 24rpx 32rpx; padding: 28rpx; display: flex; flex-direction: column; gap: 12rpx; }
.sd-price-row { display: flex; align-items: baseline; gap: 8rpx; }
.sd-price-sym { font-size: 28rpx; font-weight: var(--font-weight-bold); color: var(--color-price); }
.sd-price { font-size: 48rpx; font-weight: var(--font-weight-bold); color: var(--color-price); }
.sd-original { font-size: 24rpx; color: var(--color-on-surface-variant); text-decoration: line-through; margin-left: 6rpx; }
.sd-tag { margin-left: auto; padding: 4rpx 16rpx; border-radius: var(--radius-full); background: var(--glass-bg-primary); }
.sd-tag text { font-size: 20rpx; color: #FFFFFF; font-weight: var(--font-weight-bold); }
.sd-name { font-size: 36rpx; font-weight: var(--font-weight-bold); color: var(--color-on-surface); }
.sd-subtitle { font-size: 26rpx; color: var(--color-on-surface-variant); }
.sd-meta { display: flex; gap: 32rpx; margin-top: 8rpx; }
.sd-meta-item { font-size: 24rpx; color: var(--color-on-surface-variant); }

/* 详情描述 */
.sd-desc { margin: 0 32rpx 24rpx; padding: 28rpx; display: flex; flex-direction: column; gap: 16rpx; }
.sd-desc-title { font-size: 30rpx; font-weight: var(--font-weight-bold); color: var(--color-on-surface); }
.sd-desc-text { font-size: 26rpx; color: var(--color-on-surface-variant); line-height: 1.7; white-space: pre-wrap; }

/* 加载态 */
.sd-loading { display: flex; align-items: center; justify-content: center; padding-top: 240rpx; color: var(--color-on-surface-variant); font-size: 28rpx; }

/* 底部操作栏（固定；不透明底 + 内阴影，无 backdrop-filter） */
.sd-bottom-bar {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 100;
  display: flex; align-items: center; gap: 20rpx;
  padding: 16rpx 32rpx;
  padding-bottom: calc(16rpx + env(safe-area-inset-bottom));
  background: var(--glass-bg-nav);
  border-top: var(--glass-border-subtle);
  box-shadow: 0 -2rpx 16rpx rgba(120, 108, 94, 0.12);
}
.sd-fav {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  width: 96rpx; flex-shrink: 0;
}
.sd-fav-icon { font-size: 40rpx; line-height: 1.1; color: var(--color-on-surface-variant); }
.sd-fav.active .sd-fav-icon { color: var(--color-primary); }
.sd-fav-label { font-size: 20rpx; color: var(--color-on-surface-variant); }
.sd-buy-btn {
  flex: 1; height: 88rpx; border-radius: var(--radius-full);
  background: var(--glass-bg-primary);
  display: flex; align-items: center; justify-content: center;
  box-shadow: var(--glass-shadow-button);
}
.sd-buy-btn text { font-size: 32rpx; font-weight: var(--font-weight-bold); color: #FFFFFF; }
.sd-buy-btn:active { transform: scale(0.98); }
```

- [ ] **Step 5: 在 `app.json` 注册新页面**

在 `miniprogram/app.json` 的 `pages` 数组中，于 `"pages/shop/shop",` 之后插入 `"pages/shop-detail/shop-detail",`（顺序无强制要求，放在 `shop` 后便于阅读）：

```json
  "pages": [
    "pages/main/main",
    "pages/shop/shop",
    "pages/shop-detail/shop-detail",
    "pages/store/store",
    "pages/points/points",
    "pages/coupons/coupons",
    "pages/address/address",
    "pages/settings/settings",
    "pages/tiers/tiers",
    "pages/recharge/recharge",
    "pages/claim-center/claim-center",
    "pages/lucky-wheel/lucky-wheel"
  ],
```

- [ ] **Step 6: WeChat DevTools 验证**

1. 编译无报错（`shop-detail.json` 存在 → 不出现系统导航栏叠加自定义顶栏；记忆 `miniprogram-page-nav`）。
2. 从主页商城 tab 或独立商城页点任一商品 → 进入详情页：顶栏返回键可用、标题"商品详情"；图片轮播（多图时显指示点）；价格/划线原价/库存/已售/详情描述正常；底部"立即购买"点击弹「下单功能即将上线」。
3. 点底部"收藏"心形 → 实心/空心切换并 toast；返回列表（Task 8 `onShow` 重新拉取）该商品收藏态与详情页一致。
4. 未登录态进入：详情可看（`optionalAuth`，`isFavorited` 为 0）；点收藏触发 `auth` 401 → `api` 自动登录重试后成功。
5. 真机预览确认固定顶/底栏无切前台闪烁（无 `backdrop-filter`）。

- [ ] **Step 7: Commit**

```bash
git add miniprogram/pages/shop-detail/ miniprogram/app.json
git commit -m "feat: v1.4.0 shop product detail page (favorite + buy stub)"
```

## Task 10: 小程序收藏页（pages/favorites）+ 入口接管

**Files:**
- Create: `miniprogram/pages/favorites/favorites.js`
- Create: `miniprogram/pages/favorites/favorites.json`
- Create: `miniprogram/pages/favorites/favorites.wxml`
- Create: `miniprogram/pages/favorites/favorites.wxss`
- Modify: `miniprogram/app.json`（`pages` 数组追加 `"pages/favorites/favorites"`）
- Modify: `miniprogram/pages/profile/profile.js:63`（`actions.favorites` 由 `/pages/address/address` 改向 `/pages/favorites/favorites`）

**Interfaces:**
- Consumes:
  - `GET /shop/favorites`（Task 3，需登录）→ 数组，每项是 `shop_products` 行（`formatFavorite`：`{...p, images:[], isFavorited:true}`），含 `id, name, subtitle, price, original_price, main_image, images[], stock, sales, tag`。**`id` 即商品 id**，用于跳详情与取消收藏。`main_image` 为相对路径，需 `fixImageUrl`。
  - `DELETE /shop/favorites/:productId`（Task 3，需登录，按**商品 id**删）。
  - `api.{get,del}`、`fixImageUrl`（`utils/api.js`）；`getBackBtnTopBar()`（`utils/layout.js`，无参）。
- Produces: 「我的收藏」页，由 profile 收藏入口进入（Task 7 已把主页商城 tab 的 `onMenuItem.favorites` 改向本页；本任务接管 profile 页同名入口）。卡片点按跳商城详情页；心形取消收藏后乐观移除。

> 普通 Page，页面原生滚动，固定顶栏。**禁止 `backdrop-filter`**。`onShow` 每次拉取收藏列表，保证从详情页取消收藏返回后列表同步。空态与列表用 `wx:if/wx:elif` 避免加载中闪空态。

- [ ] **Step 1: 新建 `favorites.js`**

```js
// pages/favorites/favorites.js — 我的收藏（会员商城）
const { api, fixImageUrl } = require('../../utils/api');
const { getBackBtnTopBar } = require('../../utils/layout');

Page({
  data: {
    statusBarHeight: 44,
    topBarTotalHeight: 80,
    favorites: [],
    loading: true,
  },

  onLoad() {
    this.setData(getBackBtnTopBar());
  },

  onShow() {
    // 每次进入/返回都刷新（详情页取消收藏后列表同步）
    this.fetchFavorites();
  },

  fetchFavorites() {
    api.get('/shop/favorites').then(res => {
      if (res.code === 0) {
        const favorites = (res.data || []).map(p => ({
          ...p,
          main_image: fixImageUrl(p.main_image),
        }));
        this.setData({ favorites, loading: false });
      } else {
        this.setData({ loading: false });
      }
    }).catch(() => {
      this.setData({ loading: false });
    });
  },

  onBack() { wx.navigateBack(); },

  onTapProduct(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({ url: '/pages/shop-detail/shop-detail?id=' + id });
  },

  onRemove(e) {
    const { id } = e.currentTarget.dataset;
    const prev = this.data.favorites;
    // 乐观移除
    this.setData({ favorites: prev.filter(p => p.id !== id) });
    api.del('/shop/favorites/' + id).then(res => {
      if (!res || res.code !== 0) throw new Error('remove failed');
      wx.showToast({ title: '已取消收藏', icon: 'none' });
    }).catch(() => {
      // 回滚（request 层已弹错误提示）
      this.setData({ favorites: prev });
    });
  },
});
```

- [ ] **Step 2: 新建 `favorites.json`**

```json
{
  "navigationStyle": "custom",
  "navigationBarTitleText": "我的收藏",
  "usingComponents": {}
}
```

- [ ] **Step 3: 新建 `favorites.wxml`**

```html
<!-- pages/favorites/favorites.wxml — 我的收藏（黏土风，无 backdrop-filter；页面原生滚动） -->
<view class="fav-page" style="padding-top: {{topBarTotalHeight}}px">
  <!-- 顶部返回栏（固定） -->
  <view class="fav-top-bar" style="padding-top: {{statusBarHeight}}px;">
    <view class="fav-back-btn" bindtap="onBack"><text class="fav-back-icon">‹</text></view>
    <text class="fav-top-title">我的收藏</text>
    <view class="fav-back-btn fav-back-placeholder"></view>
  </view>

  <!-- 列表 -->
  <view class="fav-list" wx:if="{{favorites.length > 0}}">
    <view
      class="fav-card"
      wx:for="{{favorites}}"
      wx:key="id"
      bindtap="onTapProduct"
      data-id="{{item.id}}"
    >
      <image class="fav-img" src="{{item.main_image}}" mode="aspectFill"></image>
      <view class="fav-body">
        <text class="fav-name">{{item.name}}</text>
        <text class="fav-sub" wx:if="{{item.subtitle}}">{{item.subtitle}}</text>
        <view class="fav-bottom">
          <view class="fav-price-row">
            <text class="fav-price-sym">¥</text>
            <text class="fav-price">{{item.price}}</text>
            <text class="fav-original" wx:if="{{item.original_price}}">¥{{item.original_price}}</text>
          </view>
          <view class="fav-remove" catchtap="onRemove" data-id="{{item.id}}">
            <text class="fav-remove-icon">♥</text>
          </view>
        </view>
      </view>
    </view>

    <view style="height: calc(60rpx + env(safe-area-inset-bottom))"></view>
  </view>

  <!-- 空态（加载完成后才显示，避免闪烁） -->
  <view class="fav-empty" wx:elif="{{!loading}}">
    <text class="fav-empty-icon">🤍</text>
    <text class="fav-empty-text">还没有收藏的好物</text>
    <text class="fav-empty-sub">去商城逛逛，点心形即可收藏</text>
  </view>
</view>
```

- [ ] **Step 4: 新建 `favorites.wxss`**

> 令牌均已对照 `app.wxss` 确认：`--glass-bg-nav`/`--glass-bg-card`/`--glass-bg-primary-light`/`--glass-border-subtle`/`--glass-border-colored`/`--glass-shadow-card`/`--color-on-surface`/`--color-on-surface-variant`/`--color-price`/`--color-primary`/`--color-surface-container`/`--radius-full`/`--radius-card`/`--radius-sm`/`--font-weight-bold`。**全文无 `backdrop-filter`。**

```css
/* pages/favorites/favorites.wxss — 我的收藏（黏土风；无 backdrop-filter） */
.fav-page { min-height: 100vh; box-sizing: border-box; }

/* 顶部返回栏（固定） */
.fav-top-bar {
  position: fixed; top: 0; left: 0; right: 0; z-index: 100;
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 24rpx 20rpx;
  background: var(--glass-bg-nav);
  border-bottom: var(--glass-border-subtle);
  box-shadow: 0 2rpx 16rpx rgba(120, 108, 94, 0.10);
}
.fav-back-btn {
  width: 64rpx; height: 64rpx; border-radius: var(--radius-full);
  background: var(--glass-bg-card); border: var(--glass-border-subtle);
  display: flex; align-items: center; justify-content: center;
}
.fav-back-placeholder { background: transparent; border: none; box-shadow: none; }
.fav-back-icon { font-size: 48rpx; line-height: 1; color: var(--color-on-surface); }
.fav-top-title { font-size: 34rpx; font-weight: var(--font-weight-bold); color: var(--color-on-surface); }

/* 列表 */
.fav-list { padding: 24rpx 32rpx 0; display: flex; flex-direction: column; gap: 20rpx; }
.fav-card {
  display: flex; gap: 20rpx; padding: 20rpx;
  background: var(--glass-bg-card); border: var(--glass-border-subtle);
  border-radius: var(--radius-card); box-shadow: var(--glass-shadow-card);
}
.fav-img { width: 160rpx; height: 160rpx; border-radius: var(--radius-sm); flex-shrink: 0; background: var(--color-surface-container); }
.fav-body { flex: 1; display: flex; flex-direction: column; gap: 8rpx; min-width: 0; }
.fav-name { font-size: 30rpx; font-weight: var(--font-weight-bold); color: var(--color-on-surface); }
.fav-sub { font-size: 24rpx; color: var(--color-on-surface-variant); }
.fav-bottom { display: flex; align-items: center; justify-content: space-between; margin-top: auto; }
.fav-price-row { display: flex; align-items: baseline; gap: 6rpx; }
.fav-price-sym { font-size: 24rpx; font-weight: var(--font-weight-bold); color: var(--color-price); }
.fav-price { font-size: 38rpx; font-weight: var(--font-weight-bold); color: var(--color-price); }
.fav-original { font-size: 22rpx; color: var(--color-on-surface-variant); text-decoration: line-through; margin-left: 4rpx; }
.fav-remove {
  width: 60rpx; height: 60rpx; border-radius: var(--radius-full);
  background: var(--glass-bg-primary-light); border: var(--glass-border-colored);
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.fav-remove:active { transform: scale(0.9); }
.fav-remove-icon { font-size: 34rpx; line-height: 1; color: var(--color-primary); }

/* 空态 */
.fav-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding-top: 200rpx; gap: 12rpx; }
.fav-empty-icon { font-size: 96rpx; line-height: 1; }
.fav-empty-text { font-size: 30rpx; font-weight: var(--font-weight-bold); color: var(--color-on-surface); }
.fav-empty-sub { font-size: 24rpx; color: var(--color-on-surface-variant); }
```

- [ ] **Step 5: 在 `app.json` 注册收藏页**

在 `pages` 数组中，于 `"pages/shop-detail/shop-detail",` 之后插入 `"pages/favorites/favorites",`（与 Task 9 的 shop-detail 注册一并完成；最终 `pages` 头部应为）：

```json
  "pages": [
    "pages/main/main",
    "pages/shop/shop",
    "pages/shop-detail/shop-detail",
    "pages/favorites/favorites",
    "pages/store/store",
    "pages/points/points",
    "pages/coupons/coupons",
    "pages/address/address",
    "pages/settings/settings",
    "pages/tiers/tiers",
    "pages/recharge/recharge",
    "pages/claim-center/claim-center",
    "pages/lucky-wheel/lucky-wheel"
  ],
```

- [ ] **Step 6: profile 收藏入口改向**

`miniprogram/pages/profile/profile.js` 第 63 行（`onMenuItem` 的 `actions` 映射），把收藏入口由地址页改向新收藏页：

```diff
-      favorites: '/pages/address/address',
+      favorites: '/pages/favorites/favorites',
```

> 主页商城 tab 的同名入口（`main.js` 的 `onMenuItem`）已在 Task 7 Step 9 改向，无需在此重复。

- [ ] **Step 7: WeChat DevTools 验证**

1. 编译无报错；`favorites.json` 存在 → 无系统导航栏叠加。
2. 「我的」页点「收藏」入口 → 进入收藏页（不再跳地址页）。
3. 已收藏若干商品时：列表显示缩略图/名称/价格/划线原价；点卡片跳商城详情页；点心形取消收藏 → 该项乐观移除并 toast「已取消收藏」。
4. 收藏为空时显示空态（🤍 + 文案），不在加载中闪空态。
5. 从详情页取消收藏后返回收藏页（`onShow` 重新拉取）→ 列表同步去除该项。
6. 真机预览确认固定顶栏无切前台闪烁。

- [ ] **Step 8: Commit**

```bash
git add miniprogram/pages/favorites/ miniprogram/app.json miniprogram/pages/profile/profile.js
git commit -m "feat: v1.4.0 favorites page + profile entry takeover"
```

---

## 部署与端到端验收（Phase 1 收尾）

> 各任务已含本地验证步骤；本段是整模块部署 + 跨端回归 + 推送的汇总。Phase 2（商城单独支付下单）不在本期范围：`shop_orders`/`shop_order_items` 表已在 Task 1 预建，但无下单/支付流程；详情页「立即购买」当前为占位 toast。

- [ ] **Step 1: 后端部署（迁移 + PM2）**

```bash
# 迁移（Task 1 已把 migrate_shop_module.sql 追加进 deploy.py 迁移清单）
python soybean-admin-temp/deploy.py backend
```

迁移仅 `CREATE TABLE IF NOT EXISTS`（5 张新表，无 `ALTER`，幂等；不触发生产 MySQL 不支持的 `ADD COLUMN IF NOT EXISTS`）。

> 记忆 `deploy-migration-gotchas`：`deploy.py` 结尾打印 `✓` 在 GBK 控制台可能崩溃导致退出码非 0——**以输出里的 `OK`/迁移成功行判定，勿只看退出码**。

验证（生产库）：`SHOW TABLES LIKE 'shop_%';` → 期望 5 行（`shop_categories, shop_favorites, shop_order_items, shop_orders, shop_products`）。

- [ ] **Step 2: 后台部署（SPA）**

```bash
$env:PATH = "C:\Program Files\nodejs;" + $env:PATH   # Node v22，覆盖系统默认 v18
cd soybean-admin-temp; pnpm build
cd ..; python soybean-admin-temp/deploy.py frontend
```

- [ ] **Step 3: 生产公开接口自测（curl）**

```bash
# 用 apex 域名 artaides.com（记忆 prod-curl-apex-not-www：www 子域证书 WRONG_PRINCIPAL）
curl https://artaides.com/api/v1/shop/categories
curl https://artaides.com/api/v1/shop/products
```

期望均返回 `{"code":0,"data":[...]}`（含管理端新建的分类/商品；商品项含 `images:[]`、`isFavorited:false`、`main_image` 相对路径）。

- [ ] **Step 4: 小程序上传发布**

WeChat 开发者工具打开 `miniprogram/` → 上传（无 CLI 构建）。确认 `images/` 体积未超 2MB（本期未新增图片资源）。

- [ ] **Step 5: 端到端验收清单**

后台（管理端）：
1. 商城 → 分类：新建分类（**图片上传**图标）、改名/启停/排序；含商品的分类删除被拦截（提示「该分类下还有 N 个商品」）。
2. 商城 → 商品：新建商品（**多图上传** `images`，`main_image` 取 `images[0]` 兜底）、关联分类、设原价/库存/标签；列表 `NSwitch` 切上下架。

小程序（核心约束验收）：
3. 主页「会员商城」tab 与独立商城页：数据来自 `/shop`（**非** `/products`，与点单解耦）；分类横滑按 `shop_category_key` 过滤；分类图标为图片。
4. **不混入购物车**：商城商品卡无步进器/加入购物车；只有收藏心形 + 跳详情。
5. 详情页：图片轮播、价格/划线原价/库存/已售/详情描述；「立即购买」弹「下单功能即将上线」；收藏心形切换。
6. 收藏：商城卡/详情页心形 → 收藏态切换；「我的」→「收藏」进入收藏页（不再跳地址页）；列表跳详情、取消收藏乐观移除；详情页取消后返回收藏页 `onShow` 同步。
7. 未登录态：详情/列表可看（`optionalAuth`，`isFavorited=0`），点收藏触发 401 → `api` 自动登录重试。
8. 真机：固定顶/底栏切前台无闪烁（无 `backdrop-filter`）。

回归（不破坏既有点单）：
9. 点单 tab 正常加入购物车/下单（Task 7 已从 `fetchProducts` 移除商城派生与 `syncCart` 商城同步，点单数据流不受影响）；订单/会员/我的各页正常。

- [ ] **Step 6: 推送（带版本号）**

各任务已按 `v1.4.0` 分批 commit。全部完成后推送：

```bash
git push
# 若报 schannel "missing close_notify"（记忆 git-push-schannel-postbuffer）：
#   git config http.postBuffer 524288000 && git push   # 勿削弱 TLS
```

---

## 验证标准（整体）

- [ ] 5 张 `shop_*` 表创建成功；公开接口三连（categories/products/product:id）返回 `code:0`。
- [ ] 管理端可配置分类（图片图标）与商品（多图）；分类删除有商品保护。
- [ ] 小程序商城读 `/shop`、与点单完全解耦、商品不可加购物车、可收藏、详情可看、收藏页可管理、profile 入口接管。
- [ ] 点单/订单/会员等既有功能无回归。
- [ ] 全程无 `backdrop-filter`；新页均有 `.json`（`navigationStyle:custom` + 标题）。
- [ ] 后端 + 后台已部署生产并 apex 自测；小程序已上传；代码已按 `v1.4.0` commit 并推送。

## 执行交接

计划已落盘 `docs/superpowers/plans/2026-06-24-shop-module-phase1.md`，共 10 个任务 + 部署验收。两种执行方式：

1. **Subagent-Driven（推荐）** — 每个任务派发独立子代理实现，任务间评审（规范符合 + 代码质量），末尾整分支评审，迭代快、不污染主上下文。
2. **Inline 执行** — 用 executing-plans 在本会话内分批执行 + 检查点。


