# 优惠券系统完善 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让优惠券系统三端可用——后台模板管理（含库存/限领/门槛/百分比折扣）、用户主动领取（独立领券中心 + 事务化铸券）、修复折扣计算与群发隐患。

**Architecture:** 后端为地基：扩展 `coupon_templates` + 新增 `coupon_claims` 领取记录表，领取与群发共用一个事务化铸券器 `mintCouponFromTemplate`，原子库存守卫 + 周期限领防超发/超领。后台修死链 + 表单/列表加新字段。小程序新增「领券中心」页并把结账折扣计算与后端对齐。

**Tech Stack:** Express 4 + mysql2 pool + Joi（后端，无单测框架）；Vue3 + NaiveUI + elegant-router（后台）；WeChat 小程序 WXML/WXSS/JS。

## Global Constraints

- **无自动化测试框架**：pizza-server 只有 `npm run dev/start/migrate/seed`，**不引入** jest 等。后端验证 = `npm run dev` 干净启动 + curl 断言返回 JSON；后台验证 = `pnpm build` 通过（含类型检查）+ 手动点击；小程序验证 = 微信开发者工具编译 + 目视/控制台。
- **Node 版本**：跑 `pnpm` / `pnpm gen-route` / `pnpm build` 前必须在 PowerShell 执行 `$env:PATH = "C:\Program Files\nodejs;" + $env:PATH`（系统默认 v18，pnpm/Soybean 需 ≥ v22.13）。
- **生产 MySQL 不支持 `ADD COLUMN IF NOT EXISTS`** → 迁移用普通 `ADD COLUMN`（重复执行只产生无害 Duplicate-column 警告）。
- **deploy.py 迁移清单是硬编码的** → 新迁移文件必须手动登记进 `soybean-admin-temp/deploy.py` 的 `migrations` 列表。
- **camelCase(API) ↔ snake_case(DB) 映射**：controller 收 camel、service 存 snake、formatXxx 出 camel；漏映射会导致对象替换时属性丢失。
- **elegant-router 路由名全小写**；改路由后跑 `pnpm gen-route` 同步生成产物。
- **小程序新页**必须有 `.json`（`"navigationStyle":"custom"` + 页面标题），并在 `app.json` pages / `main.js` routes / `profile.js` actions 四处同步。
- **WXSS**：rpx 为主单位；固定底栏/spacer 加 `env(safe-area-inset-bottom)`；卡片背景图用 `<image>` 绝对定位层，勿用 `background` 简写带 `/`。
- **乐观更新**必须在 async 调用**之前**同步执行。
- **领取门槛等级**：用 `computeTier(total_spent).levelIndex`（1..5）比 `min_member_level`，**不直接读** `users.member_level`（它是 VARCHAR 等级 key，且现行后端折扣判定也走 computeTier）。
- **百分比折扣语义**：`discount_value` 存百分比整数（`"10"` = 立减 10% = 9 折）；`discount = 小计 × pct/100`，`max_discount` 非空则封顶。
- **half_price 语义**：最低价商品半价（`最低价件.price × 0.5 × 该件数量`），前后端一致。
- **Git**：本仓库已持久化 `http.sslBackend=openssl` + `http.postBuffer`；push 偶发 `unexpected eof` 直接重试一次。**禁止**削弱 TLS。提交只 `git add` 具体子项目路径，**不要** stage 根目录散落的 PNG。
- 本计划**只写代码 + 带版本号 commit**；部署（deploy.py backend/frontend、小程序微信上传）是**单独、需用户授权**的步骤，不在本计划内执行。

---

# Phase 1 — 后端（pizza-server）

## Task 1: 数据库迁移 + schema.sql 同步 + deploy.py 登记

**Files:**
- Create: `pizza-server/db/migrate_coupon_claimable.sql`
- Modify: `pizza-server/db/schema.sql:180-208`（coupons）、`pizza-server/db/schema.sql:275-290`（coupon_templates）
- Modify: `soybean-admin-temp/deploy.py:49-59`（migrations 列表）

**Interfaces:**
- Produces: 列 `coupon_templates.{claimable,total_stock,claimed_count,per_user_limit,claim_period,min_member_level,max_discount}`、`coupons.{template_id,max_discount}`、`discount_type` 枚举含 `'percentage'`、新表 `coupon_claims(id,template_id,user_id,coupon_id,period_key,claimed_at)`。后续所有任务依赖这些列。

- [ ] **Step 1: 写迁移文件**

Create `pizza-server/db/migrate_coupon_claimable.sql`:
```sql
-- 优惠券系统完善：模板领取规则 + 百分比折扣 + 领取记录表
-- 生产 MySQL 不支持 ADD COLUMN IF NOT EXISTS，用普通 ADD COLUMN（重复执行产生无害 Duplicate column 警告）

ALTER TABLE coupon_templates
  ADD COLUMN claimable        TINYINT(1)    NOT NULL DEFAULT 0,
  ADD COLUMN total_stock      INT UNSIGNED  NULL,
  ADD COLUMN claimed_count    INT UNSIGNED  NOT NULL DEFAULT 0,
  ADD COLUMN per_user_limit   INT UNSIGNED  NOT NULL DEFAULT 1,
  ADD COLUMN claim_period     ENUM('none','weekly','monthly') NOT NULL DEFAULT 'none',
  ADD COLUMN min_member_level INT           NOT NULL DEFAULT 0,
  ADD COLUMN max_discount     DECIMAL(10,2) NULL;

ALTER TABLE coupon_templates
  MODIFY COLUMN discount_type ENUM('free_redeem','buy_one_get_one','free_delivery','half_price','fixed_amount','percentage') DEFAULT 'fixed_amount';

ALTER TABLE coupons
  ADD COLUMN template_id  INT UNSIGNED  NULL,
  ADD COLUMN max_discount DECIMAL(10,2) NULL;

ALTER TABLE coupons
  MODIFY COLUMN discount_type ENUM('free_redeem','buy_one_get_one','free_delivery','half_price','fixed_amount','percentage') NULL;

CREATE TABLE IF NOT EXISTS coupon_claims (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    template_id INT UNSIGNED NOT NULL,
    user_id     INT UNSIGNED NOT NULL,
    coupon_id   INT UNSIGNED NOT NULL,
    period_key  VARCHAR(16)  NOT NULL DEFAULT '',
    claimed_at  DATETIME     DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (template_id) REFERENCES coupon_templates(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)     REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_tpl_user_period (template_id, user_id, period_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

- [ ] **Step 2: 同步 schema.sql（新装环境一致）**

In `pizza-server/db/schema.sql`, coupons 表（L191）枚举改为含 `percentage`，并在 `min_spend` 行后加两列：
```sql
    discount_type ENUM('free_redeem','buy_one_get_one','free_delivery','half_price','fixed_amount','percentage') NULL,
    discount_value VARCHAR(100) DEFAULT '',
    min_spend DECIMAL(10,2) DEFAULT 0.00,
    template_id INT UNSIGNED NULL,
    max_discount DECIMAL(10,2) NULL,
```
coupon_templates 表（L281）枚举改为含 `percentage`，并在 `is_active` 行前加新列：
```sql
    discount_type ENUM('free_redeem','buy_one_get_one','free_delivery','half_price','fixed_amount','percentage') DEFAULT 'fixed_amount',
    discount_value VARCHAR(100) DEFAULT '',
    min_spend DECIMAL(10,2) DEFAULT 0.00,
    valid_days INT DEFAULT 30,
    color VARCHAR(7) DEFAULT '#D32F2F',
    use_tip VARCHAR(300) DEFAULT '',
    claimable TINYINT(1) NOT NULL DEFAULT 0,
    total_stock INT UNSIGNED NULL,
    claimed_count INT UNSIGNED NOT NULL DEFAULT 0,
    per_user_limit INT UNSIGNED NOT NULL DEFAULT 1,
    claim_period ENUM('none','weekly','monthly') NOT NULL DEFAULT 'none',
    min_member_level INT NOT NULL DEFAULT 0,
    max_discount DECIMAL(10,2) NULL,
    is_active TINYINT(1) DEFAULT 1,
```
并在 coupon_templates 表定义**之后**追加 `coupon_claims` 建表语句（同 Step 1 的 CREATE TABLE 块）。

- [ ] **Step 3: 登记进 deploy.py**

In `soybean-admin-temp/deploy.py`, 在 `migrations` 列表（L49-59）末尾、`migrate_store_pickup_notice.sql` 之后加一行：
```python
        'pizza-server/db/migrate_store_pickup_notice.sql',
        'pizza-server/db/migrate_coupon_claimable.sql',
    ]
```

- [ ] **Step 4: 本地执行迁移并验证**

Run（本地 MySQL；从 `.env` 取库名）:
```bash
mysql -u <DB_USER> -p<DB_PASSWORD> <DB_NAME> < pizza-server/db/migrate_coupon_claimable.sql
mysql -u <DB_USER> -p<DB_PASSWORD> <DB_NAME> -e "DESCRIBE coupon_templates; DESCRIBE coupon_claims; SHOW COLUMNS FROM coupons LIKE 'max_discount';"
```
Expected: `coupon_templates` 含 `claimable/total_stock/claimed_count/per_user_limit/claim_period/min_member_level/max_discount`；`coupon_claims` 6 列存在；`coupons` 含 `max_discount`。重复执行迁移只报 `Duplicate column` 警告，不报错退出。

- [ ] **Step 5: Commit**

```bash
git add pizza-server/db/migrate_coupon_claimable.sql pizza-server/db/schema.sql soybean-admin-temp/deploy.py
git commit -m "feat(coupon): v1.1.0 迁移-模板领取规则/百分比/coupon_claims 表 + deploy 登记"
```

---

## Task 2: 模板新字段（service 透传 + controller 映射 + Joi 校验）

**Files:**
- Modify: `pizza-server/src/services/couponTemplateService.js:14-24`（create）、`:26-41`（update）、`:53-71`（formatTemplate）
- Modify: `pizza-server/src/controllers/adminApiController.js:806-827`（create）、`:832-858`（update）
- Modify: `pizza-server/src/middleware/validation.js`（加 schema）
- Modify: `pizza-server/src/routes/adminApi.js:48-49`（挂 validate）

**Interfaces:**
- Consumes: Task 1 的列。
- Produces: `couponTemplateService.formatTemplate(row)` 现额外返回 `claimable,totalStock,claimedCount,perUserLimit,claimPeriod,minMemberLevel,maxDiscount`（供 Task 3 铸券 / Task 4 群发 / 后台读取）。create/update 接受这些 camel 字段。

- [ ] **Step 1: 扩展 service create/update/format**

In `couponTemplateService.js`，`create` 整体替换为：
```js
  async create(data) {
    const { name, desc, category, value, discount_type, discount_value, min_spend, valid_days, color, use_tip,
            claimable, total_stock, per_user_limit, claim_period, min_member_level, max_discount } = data;
    const [result] = await pool.query(
      `INSERT INTO coupon_templates
         (name, \`desc\`, category, \`value\`, discount_type, discount_value, min_spend, valid_days, color, use_tip,
          claimable, total_stock, per_user_limit, claim_period, min_member_level, max_discount)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, desc || '', category || 'discount', value || '',
       discount_type || 'fixed_amount', discount_value || '',
       min_spend || 0, valid_days || 30, color || '#D32F2F', use_tip || '',
       claimable ? 1 : 0, total_stock == null ? null : total_stock,
       per_user_limit == null ? 1 : per_user_limit, claim_period || 'none',
       min_member_level == null ? 0 : min_member_level, max_discount == null ? null : max_discount]
    );
    return this.findById(result.insertId);
  },
```
`update` 的字段白名单数组（L27-28）替换为：
```js
    const fields = ['name', 'desc', 'category', 'value', 'discount_type', 'discount_value',
      'min_spend', 'valid_days', 'color', 'use_tip', 'is_active',
      'claimable', 'total_stock', 'per_user_limit', 'claim_period', 'min_member_level', 'max_discount'];
```
`formatTemplate` 的 return 对象在 `isActive` 行后加：
```js
    isActive: !!row.is_active,
    claimable: !!row.claimable,
    totalStock: row.total_stock == null ? null : row.total_stock,
    claimedCount: row.claimed_count || 0,
    perUserLimit: row.per_user_limit == null ? 1 : row.per_user_limit,
    claimPeriod: row.claim_period || 'none',
    minMemberLevel: row.min_member_level || 0,
    maxDiscount: row.max_discount == null ? null : parseFloat(row.max_discount),
```

- [ ] **Step 2: controller 映射新字段**

In `adminApiController.js`，`createCouponTemplate`（L808-821）的解构与 service 入参替换为：
```js
      const { name, desc, category, value, discountType, discountValue,
              minSpend, validDays, color, useTip,
              claimable, totalStock, perUserLimit, claimPeriod, minMemberLevel, maxDiscount } = req.body;
      const template = await couponTemplateService.create({
        name, desc, category, value,
        discount_type: discountType, discount_value: discountValue,
        min_spend: minSpend, valid_days: validDays, color, use_tip: useTip,
        claimable, total_stock: totalStock, per_user_limit: perUserLimit,
        claim_period: claimPeriod, min_member_level: minMemberLevel, max_discount: maxDiscount,
      });
```
`updateCouponTemplate`（L834-847）在 `if (isActive !== undefined) ...` 行后追加：
```js
      if (claimable !== undefined) updateData.claimable = claimable ? 1 : 0;
      if (totalStock !== undefined) updateData.total_stock = totalStock;
      if (perUserLimit !== undefined) updateData.per_user_limit = perUserLimit;
      if (claimPeriod !== undefined) updateData.claim_period = claimPeriod;
      if (minMemberLevel !== undefined) updateData.min_member_level = minMemberLevel;
      if (maxDiscount !== undefined) updateData.max_discount = maxDiscount;
```
并把该方法解构行（L834-835）补上新字段名：
```js
      const { name, desc, category, value, discountType, discountValue,
              minSpend, validDays, color, useTip, isActive,
              claimable, totalStock, perUserLimit, claimPeriod, minMemberLevel, maxDiscount } = req.body;
```

- [ ] **Step 3: 加 Joi 校验 schema**

In `validation.js`，`schemas` 对象内（`redeemPoints` 之后）加：
```js
  couponTemplate: Joi.object({
    name: Joi.string().required().max(100).messages({ 'string.empty': '请输入模板名称' }),
    desc: Joi.string().allow('').max(200).default(''),
    category: Joi.string().valid('discount', 'redeem').default('discount'),
    value: Joi.string().allow('').max(100).default(''),
    discountType: Joi.string().valid('free_redeem','buy_one_get_one','free_delivery','half_price','fixed_amount','percentage').default('fixed_amount'),
    discountValue: Joi.string().allow('').max(100).default(''),
    minSpend: Joi.number().min(0).default(0),
    validDays: Joi.number().integer().min(1).default(30),
    color: Joi.string().allow('').max(20).default('#D32F2F'),
    useTip: Joi.string().allow('').max(300).default(''),
    isActive: Joi.boolean().optional(),
    claimable: Joi.boolean().default(false),
    totalStock: Joi.number().integer().min(0).allow(null).default(null),
    perUserLimit: Joi.number().integer().min(1).default(1),
    claimPeriod: Joi.string().valid('none','weekly','monthly').default('none'),
    minMemberLevel: Joi.number().integer().min(0).default(0),
    maxDiscount: Joi.number().min(0).allow(null).default(null),
  }),
```

- [ ] **Step 4: 路由挂 validate**

In `adminApi.js`，引入处确认有 `const { validate } = require('../middleware/validation');`（无则加）。把 create/update 两行（L48-49）改为：
```js
  router.post('/coupon-templates', validate('couponTemplate'), ctrl.createCouponTemplate);
  router.put('/coupon-templates/:id', validate('couponTemplate'), ctrl.updateCouponTemplate);
```
（保持与文件现有 `ctrl`/控制器引用名一致——按文件实际写法替换处理器引用。）

- [ ] **Step 5: 启动并 curl 验证**

Run: `cd pizza-server && npm run dev`（确认无报错启动）。另开终端，用管理员 JWT：
```bash
TOKEN=<admin_jwt>
curl -s -X POST http://localhost:3000/api/v1/admin/coupon-templates \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"测试满减","category":"discount","discountType":"percentage","discountValue":"10","minSpend":50,"maxDiscount":15,"claimable":true,"totalStock":100,"perUserLimit":1,"claimPeriod":"weekly","minMemberLevel":2,"validDays":7}'
```
Expected: `{"code":0,...,"data":{...,"claimable":true,"totalStock":100,"claimPeriod":"weekly","minMemberLevel":2,"maxDiscount":15,...}}`。再 `GET /api/v1/admin/coupon-templates` 应能读回这些字段。非法值（如 `claimPeriod:"daily"`）应返回 400。

- [ ] **Step 6: Commit**

```bash
git add pizza-server/src/services/couponTemplateService.js pizza-server/src/controllers/adminApiController.js pizza-server/src/middleware/validation.js pizza-server/src/routes/adminApi.js
git commit -m "feat(coupon): v1.1.0 模板支持库存/限领/门槛/百分比字段 + Joi 校验"
```

---

## Task 3: 领取服务 + 路由 + 控制器（核心）

**Files:**
- Create: `pizza-server/src/services/couponClaimService.js`
- Modify: `pizza-server/src/controllers/couponController.js`（加 listClaimable + claim）
- Modify: `pizza-server/src/routes/coupons.js:7-10`（加 2 路由）
- Modify: `pizza-server/src/middleware/validation.js`（加 claimCoupon schema）

**Interfaces:**
- Consumes: Task 1 列、Task 2 的 `couponTemplateService` 字段、`utils/memberTier.computeTier`。
- Produces: `couponClaimService.mintCouponFromTemplate(conn, tpl, userId, source) -> Promise<number(couponId)>`（Task 4 复用）、`computePeriodKey(claimPeriod, date?) -> string`、`listClaimable(userId)`、`claim(userId, templateId) -> {couponId}|{error,reason}`。
- API: `GET /api/v1/coupons/claimable`、`POST /api/v1/coupons/claim {templateId}`。

- [ ] **Step 1: 写 couponClaimService.js**

Create `pizza-server/src/services/couponClaimService.js`:
```js
const pool = require('../config/database');
const { computeTier } = require('../utils/memberTier');

// ISO 周键 'YYYY-Www'（周一为周首）
function isoWeekKey(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function computePeriodKey(claimPeriod, date = new Date()) {
  if (claimPeriod === 'weekly') return isoWeekKey(date);
  if (claimPeriod === 'monthly') return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  return '';
}

// 由模板派生一张 coupons 行（事务内调用）。tpl 为 camelCase 模板对象。
async function mintCouponFromTemplate(conn, tpl, userId, source) {
  const now = new Date();
  const validFrom = now.toISOString().slice(0, 10);
  const validTo = new Date(now.getTime() + (tpl.validDays || 30) * 86400000).toISOString().slice(0, 10);
  const code = `CPN-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const [result] = await conn.query(
    `INSERT INTO coupons
       (user_id, template_id, name, \`desc\`, category, \`value\`, status, code,
        discount_type, discount_value, min_spend, max_discount, valid_from, valid_to, use_tip, color, source)
     VALUES (?, ?, ?, ?, ?, ?, 'available', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, tpl.id, tpl.name, tpl.desc || '', tpl.category, tpl.value || '', code,
     tpl.discountType, tpl.discountValue || '', tpl.minSpend || 0,
     tpl.maxDiscount == null ? null : tpl.maxDiscount,
     validFrom, validTo, tpl.useTip || '', tpl.color || '#D32F2F', source]
  );
  return result.insertId;
}

// 把 FOR UPDATE 锁到的 snake 行转成 mint 所需 camel 形状
function rowToTpl(t) {
  return {
    id: t.id, name: t.name, desc: t.desc, category: t.category, value: t.value,
    discountType: t.discount_type, discountValue: t.discount_value,
    minSpend: t.min_spend, maxDiscount: t.max_discount, validDays: t.valid_days,
    useTip: t.use_tip, color: t.color,
  };
}

async function userLevelIndex(totalSpent) {
  const tier = await computeTier(parseFloat(totalSpent || 0));
  return tier.levelIndex || 0;
}

const couponClaimService = {
  computePeriodKey,
  mintCouponFromTemplate,

  async listClaimable(userId) {
    const [tpls] = await pool.query(
      'SELECT * FROM coupon_templates WHERE is_active = 1 AND claimable = 1 ORDER BY id DESC'
    );
    const [[u]] = await pool.query('SELECT total_spent FROM users WHERE id = ?', [userId]);
    const level = await userLevelIndex(u ? u.total_spent : 0);
    const out = [];
    for (const t of tpls) {
      const periodKey = computePeriodKey(t.claim_period);
      const [[{ cnt }]] = await pool.query(
        'SELECT COUNT(*) AS cnt FROM coupon_claims WHERE template_id = ? AND user_id = ? AND period_key = ?',
        [t.id, userId, periodKey]
      );
      const remainingStock = t.total_stock == null ? null : Math.max(0, t.total_stock - t.claimed_count);
      let canClaim = true; let reason = 'ok';
      if (level < t.min_member_level) { canClaim = false; reason = 'level_too_low'; }
      else if (cnt >= t.per_user_limit) { canClaim = false; reason = 'reach_limit'; }
      else if (remainingStock !== null && remainingStock <= 0) { canClaim = false; reason = 'out_of_stock'; }
      out.push({
        id: t.id, name: t.name, desc: t.desc, category: t.category, value: t.value,
        discountType: t.discount_type, discountValue: t.discount_value,
        minSpend: parseFloat(t.min_spend || 0),
        maxDiscount: t.max_discount == null ? null : parseFloat(t.max_discount),
        validDays: t.valid_days, color: t.color, useTip: t.use_tip,
        claimPeriod: t.claim_period, perUserLimit: t.per_user_limit, minMemberLevel: t.min_member_level,
        remainingStock, claimedInPeriod: cnt, canClaim, reason,
      });
    }
    return out;
  },

  async claim(userId, templateId) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [rows] = await conn.query('SELECT * FROM coupon_templates WHERE id = ? FOR UPDATE', [templateId]);
      const t = rows[0];
      if (!t || !t.is_active || !t.claimable) {
        await conn.rollback();
        return { error: '该优惠券不可领取', reason: 'not_claimable' };
      }
      const [[u]] = await conn.query('SELECT total_spent FROM users WHERE id = ?', [userId]);
      const level = await userLevelIndex(u ? u.total_spent : 0);
      if (level < t.min_member_level) {
        await conn.rollback();
        return { error: '会员等级不足，无法领取', reason: 'level_too_low' };
      }
      const periodKey = computePeriodKey(t.claim_period);
      const [[{ cnt }]] = await conn.query(
        'SELECT COUNT(*) AS cnt FROM coupon_claims WHERE template_id = ? AND user_id = ? AND period_key = ?',
        [templateId, userId, periodKey]
      );
      if (cnt >= t.per_user_limit) {
        await conn.rollback();
        return { error: t.claim_period === 'none' ? '已达领取上限' : '本周期已领取', reason: 'reach_limit' };
      }
      if (t.total_stock != null) {
        const [upd] = await conn.query(
          'UPDATE coupon_templates SET claimed_count = claimed_count + 1 WHERE id = ? AND claimed_count < total_stock',
          [templateId]
        );
        if (upd.affectedRows === 0) {
          await conn.rollback();
          return { error: '已被领完', reason: 'out_of_stock' };
        }
      } else {
        await conn.query('UPDATE coupon_templates SET claimed_count = claimed_count + 1 WHERE id = ?', [templateId]);
      }
      const couponId = await mintCouponFromTemplate(conn, rowToTpl(t), userId, 'claim');
      await conn.query(
        'INSERT INTO coupon_claims (template_id, user_id, coupon_id, period_key) VALUES (?, ?, ?, ?)',
        [templateId, userId, couponId, periodKey]
      );
      await conn.commit();
      return { couponId };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },
};

module.exports = couponClaimService;
```

- [ ] **Step 2: controller 加 listClaimable + claim**

In `couponController.js`，顶部加 `const couponClaimService = require('../services/couponClaimService');`，并在 `use` 方法后、`}` 前加：
```js
  async listClaimable(req, res, next) {
    try {
      const list = await couponClaimService.listClaimable(req.user.id);
      res.json({ code: 0, data: list });
    } catch (err) {
      next(err);
    }
  },

  async claim(req, res, next) {
    try {
      const result = await couponClaimService.claim(req.user.id, req.body.templateId);
      if (result.error) {
        return res.status(400).json({ code: 400, message: result.error, reason: result.reason });
      }
      res.json({ code: 0, message: '领取成功', data: { couponId: result.couponId } });
    } catch (err) {
      next(err);
    }
  },
```

- [ ] **Step 3: 加 claimCoupon schema**

In `validation.js` `schemas` 内加：
```js
  claimCoupon: Joi.object({
    templateId: Joi.number().integer().positive().required().messages({ 'any.required': '缺少模板ID' }),
  }),
```

- [ ] **Step 4: 注册路由**

In `coupons.js`，`router.use(auth);` 之后、`router.get('/', ...)` 之前加：
```js
const { validate } = require('../middleware/validation');
router.get('/claimable', controller.listClaimable);
router.post('/claim', validate('claimCoupon'), controller.claim);
```
（`validate` 引入放文件顶部 require 区；此处示意位置。）

- [ ] **Step 5: 启动并 curl 验证（含限领/库存/门槛）**

`npm run dev` 干净启动。用普通用户 JWT（`USER_TOKEN`）：
```bash
curl -s http://localhost:3000/api/v1/coupons/claimable -H "Authorization: Bearer $USER_TOKEN"
# 期望：data 数组含 Task2 建的模板，带 canClaim/reason/remainingStock/claimedInPeriod
curl -s -X POST http://localhost:3000/api/v1/coupons/claim -H "Authorization: Bearer $USER_TOKEN" -H "Content-Type: application/json" -d '{"templateId":<id>}'
# 首次（满足门槛时）期望 {"code":0,"message":"领取成功","data":{"couponId":N}}
# 同周期再领 期望 {"code":400,"message":"本周期已领取","reason":"reach_limit"}
```
等级不足时领取应返回 `level_too_low`；把模板 `total_stock` 改 1 并让两个用户抢领，第二个应得 `out_of_stock`。验证 `coupon_claims` 有记录、`coupon_templates.claimed_count` 递增、`coupons` 出现新券且 `template_id`/`max_discount` 已写入。

- [ ] **Step 6: Commit**

```bash
git add pizza-server/src/services/couponClaimService.js pizza-server/src/controllers/couponController.js pizza-server/src/routes/coupons.js pizza-server/src/middleware/validation.js
git commit -m "feat(coupon): v1.1.0 用户领取-领券中心列表+原子领取(库存/周期限领/等级门槛)"
```

---

## Task 4: 群发改事务化（复用铸券器）

**Files:**
- Modify: `pizza-server/src/controllers/adminApiController.js:1039-1074`（assignCoupon）

**Interfaces:**
- Consumes: `couponClaimService.mintCouponFromTemplate`（Task 3）、`couponTemplateService.findById`（返回 camel 模板）。

- [ ] **Step 1: 重写 assignCoupon 为单事务**

In `adminApiController.js`，顶部确认/补上 `const couponClaimService = require('../services/couponClaimService');`。`assignCoupon` 方法体（L1040-1073）替换为：
```js
    const { templateId, userIds } = req.body;
    if (!templateId || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ code: 400, message: '请选择模板和用户' });
    }
    const template = await couponTemplateService.findById(templateId);
    if (!template) {
      return res.status(404).json({ code: 404, message: '优惠券模板不存在' });
    }
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      let assigned = 0;
      for (const userId of userIds) {
        await couponClaimService.mintCouponFromTemplate(conn, template, userId, 'admin');
        assigned++;
      }
      await conn.commit();
      return res.json({ code: 0, message: `已成功发放 ${assigned} 张优惠券`, data: { assigned } });
    } catch (err) {
      await conn.rollback();
      log.error({ err }, 'AssignCoupon error');
      return res.status(500).json({ code: 500, message: err.message || '发放优惠券失败' });
    } finally {
      conn.release();
    }
```
（保留外层 `async assignCoupon(req, res) { ... }` 签名；`pool` 已在该文件顶部 require。群发**不**改 `claimed_count`、**不**写 `coupon_claims`、**不**校验限领——人工 override 直发。）

- [ ] **Step 2: curl 验证**

`npm run dev`，管理员 JWT：
```bash
curl -s -X POST http://localhost:3000/api/v1/admin/coupons/assign -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"templateId":<id>,"userIds":[1,2]}'
```
Expected: `{"code":0,"message":"已成功发放 2 张优惠券","data":{"assigned":2}}`；两用户各得一张带 `template_id`/`max_discount` 的券；`claimed_count` **未**变化。传一个不存在的 userId 触发外键错误时，应整体回滚（无任何券落库）。

- [ ] **Step 3: Commit**

```bash
git add pizza-server/src/controllers/adminApiController.js
git commit -m "fix(coupon): v1.1.0 群发改单事务+复用铸券器(部分失败整体回滚,带template_id快照)"
```

---

## Task 5: 结账折扣修复（half_price + percentage）+ formatCoupon 补 maxDiscount

**Files:**
- Modify: `pizza-server/src/controllers/orderController.js:88-105`（折扣 switch）
- Modify: `pizza-server/src/services/couponService.js:122-151`（formatCoupon）

**Interfaces:**
- Produces: `couponService.formatCoupon` 额外返回 `maxDiscount`、`templateId`（供小程序结账，Task 12）。

- [ ] **Step 1: 修折扣 switch**

In `orderController.js`，`switch (coupon.discount_type)` 内的 `half_price` case（L94-98）替换、并新增 `percentage` case：
```js
            case 'buy_one_get_one': {
              const cheapest = cartItems.reduce((min, item) => item.price < min.price ? item : min, cartItems[0]);
              discountAmount = cheapest.price;
              break;
            }
            case 'half_price': {
              const cheapest = cartItems.reduce((min, item) => item.price < min.price ? item : min, cartItems[0]);
              discountAmount = cheapest.price * 0.5 * cheapest.quantity;
              break;
            }
            case 'percentage': {
              const pct = parseFloat(coupon.discount_value) || 0;
              discountAmount = total * pct / 100;
              if (coupon.max_discount != null) {
                discountAmount = Math.min(discountAmount, parseFloat(coupon.max_discount));
              }
              break;
            }
            case 'fixed_amount':
              discountAmount = parseFloat(coupon.discount_value) || 0;
              break;
            case 'free_delivery':
              discountAmount = 0; // No delivery in current model
              break;
```
（即：删掉用 `coupon.product_id` 的旧 half_price，新 half_price 用最低价件；新增 percentage。）

- [ ] **Step 2: formatCoupon 补字段**

In `couponService.js` `formatCoupon` return（`minSpend` 行后）加：
```js
    minSpend: parseFloat(row.min_spend || 0),
    maxDiscount: row.max_discount == null ? null : parseFloat(row.max_discount),
    templateId: row.template_id == null ? null : row.template_id,
```

- [ ] **Step 3: curl 验证**

给某用户铸一张 `percentage` 券（`discountValue:"10", maxDiscount:15`），购物车小计 200，下单：
```bash
curl -s -X POST http://localhost:3000/api/v1/orders -H "Authorization: Bearer $USER_TOKEN" -H "Content-Type: application/json" -d '{"couponId":<id>,"paymentMethod":"balance"}'
```
Expected: 优惠券减免 = `min(200*10/100, 15)` = 15；返回 `discount.coupon` ≈ 15。再测 `half_price`：减免 = 最低价件 × 0.5 × 数量。`GET /coupons` 返回的券对象含 `maxDiscount`。

- [ ] **Step 4: Commit**

```bash
git add pizza-server/src/controllers/orderController.js pizza-server/src/services/couponService.js
git commit -m "fix(coupon): v1.1.0 half_price=最低价件半价+新增percentage(封顶);formatCoupon补maxDiscount"
```

---

# Phase 2 — 后台（soybean-admin-temp）

> 本阶段所有 `pnpm` 命令前先：`$env:PATH = "C:\Program Files\nodejs;" + $env:PATH`

## Task 6: 修复模板管理死链 + 同步路由产物 + 清理孤儿 i18n

**Files:**
- Modify: `soybean-admin-temp/src/views/coupons/templates/list/index.vue:62,151`
- Modify: `soybean-admin-temp/src/views/coupons/templates/form/index.vue:82,91`
- Modify: `soybean-admin-temp/src/locales/langs/zh-cn.ts:245-249`、`en-us.ts:249-253`（删孤儿键）
- Regenerate: `src/router/elegant/{transform.ts,routes.ts}`、`src/typings/elegant-router.d.ts`（`pnpm gen-route`）

- [ ] **Step 1: 修 list 页死链**

In `templates/list/index.vue`：L62 `router.push(\`/coupon-templates/${row.id}/edit\`)` → `router.push(\`/coupons/templates/${row.id}/edit\`)`；L151 `router.push('/coupon-templates/create')` → `router.push('/coupons/templates/create')`。

- [ ] **Step 2: 修 form 页死链**

In `templates/form/index.vue`：L82 与 L91 的 `'/coupon-templates/list'` 均 → `'/coupons/templates/list'`。

- [ ] **Step 3: 删孤儿 i18n 键**

In `zh-cn.ts` 删 L245-249（`couponTemplates` / `_list` / `_create` / `_edit` / `_form` 五行）；In `en-us.ts` 删 L249-253 对应五行。保留 `coupons_templates*`。

- [ ] **Step 4: 重生路由产物**

Run:
```powershell
$env:PATH = "C:\Program Files\nodejs;" + $env:PATH
cd soybean-admin-temp; pnpm gen-route
```
Expected: `transform.ts` / `elegant-router.d.ts` 出现 `coupons_templates_create`/`coupons_templates_edit` 条目，无报错。

- [ ] **Step 5: 构建验证**

Run: `pnpm build`
Expected: 构建成功（类型检查通过）。本地 `pnpm dev` 进入「优惠券 ▸ 优惠券模板 ▸ 模板列表」，点「新建模板」「编辑」「返回」均正确跳转（不再死链）。

- [ ] **Step 6: Commit**

```bash
git add soybean-admin-temp/src/views/coupons soybean-admin-temp/src/locales soybean-admin-temp/src/router/elegant soybean-admin-temp/src/typings/elegant-router.d.ts
git commit -m "fix(admin): v1.1.0 修优惠券模板管理死链(/coupon-templates→/coupons/templates)+gen-route+清孤儿i18n"
```

---

## Task 7: 后台 API 类型扩展 + fetchAssignCoupon 归位

**Files:**
- Modify: `soybean-admin-temp/src/service/api/couponTemplate.ts:3-18`（接口）、删 `:44-46`（assign 移走）
- Modify: `soybean-admin-temp/src/service/api/coupon.ts`（加 Coupon 接口 + 接收 fetchAssignCoupon）

**Interfaces:**
- Produces: `CouponTemplate` 接口含新字段；`fetchAssignCoupon` 从 `coupon.ts` 导出（barrel `index.ts` 用 `export *`，无需改）。

- [ ] **Step 1: 扩展 CouponTemplate 接口**

In `couponTemplate.ts`，`CouponTemplate` 接口在 `useTip: string;` 后加：
```ts
  claimable?: boolean;
  totalStock?: number | null;
  claimedCount?: number;
  perUserLimit?: number;
  claimPeriod?: 'none' | 'weekly' | 'monthly';
  minMemberLevel?: number;
  maxDiscount?: number | null;
```

- [ ] **Step 2: 移除 couponTemplate.ts 里的 assign**

删 `couponTemplate.ts` 的 `fetchAssignCoupon`（L44-46 整段）。

- [ ] **Step 3: coupon.ts 补类型 + 接收 assign**

`coupon.ts` 整体替换为：
```ts
import { request } from '../request';

export interface Coupon {
  id: number;
  userName?: string;
  name: string;
  category: 'redeem' | 'discount';
  code: string;
  value: string;
  status: 'available' | 'used' | 'expired';
  validTo?: string;
}

export function fetchCoupons(params?: Record<string, any>) {
  return request<Coupon[]>({ url: '/coupons', params });
}

export function fetchAssignCoupon(templateId: number, userIds: number[]) {
  return request<{ assigned: number }>({ url: '/coupons/assign', method: 'post', data: { templateId, userIds } });
}
```

- [ ] **Step 4: 构建验证**

Run: `$env:PATH = "C:\Program Files\nodejs;" + $env:PATH; cd soybean-admin-temp; pnpm build`
Expected: 成功。`templates/list/index.vue` 从 `@/service/api` 导入的 `fetchAssignCoupon` 仍解析（barrel 重导出），无类型错误。

- [ ] **Step 5: Commit**

```bash
git add soybean-admin-temp/src/service/api/couponTemplate.ts soybean-admin-temp/src/service/api/coupon.ts
git commit -m "refactor(admin): v1.1.0 CouponTemplate类型补新字段;fetchAssignCoupon归位coupon.ts+Coupon类型"
```

---

## Task 8: 模板表单加新字段控件

**Files:**
- Modify: `soybean-admin-temp/src/views/coupons/templates/form/index.vue`

- [ ] **Step 1: 表单默认值 + 百分比选项**

In `form/index.vue`，`form` 默认值（L15-26）在 `useTip: ''` 后加：
```ts
  claimable: false,
  totalStock: null,
  perUserLimit: 1,
  claimPeriod: 'none',
  minMemberLevel: 0,
  maxDiscount: null,
```
`discountTypeOptions`（L33-39）加一项：
```ts
  { label: '百分比折扣', value: 'percentage' },
```
并在 `<script setup>` 顶部 import 增补 `NSwitch`：
```ts
import { NButton, NSpace, NCard, NForm, NFormItem, NInput, NInputNumber, NSelect, NColorPicker, NSpin, NSwitch } from 'naive-ui';
```
加领取周期选项常量（`discountTypeOptions` 之后）：
```ts
const claimPeriodOptions = [
  { label: '不限周期(累计限领)', value: 'none' },
  { label: '每周', value: 'weekly' },
  { label: '每月', value: 'monthly' },
];
```

- [ ] **Step 2: onMounted 编辑回填新字段**

In `onMounted`，编辑回填对象（L48-59）在 `useTip: data.useTip,` 后加：
```ts
        claimable: data.claimable,
        totalStock: data.totalStock,
        perUserLimit: data.perUserLimit,
        claimPeriod: data.claimPeriod,
        minMemberLevel: data.minMemberLevel,
        maxDiscount: data.maxDiscount,
```
（`handleSave` 已 `payload = { ...form.value }`，新字段自动随提交，无需改。）

- [ ] **Step 3: 模板加表单项**

In `<template>` 的 `<NForm>` 内，「使用提示」项后加：
```html
        <NFormItem label="折扣封顶" v-if="form.discountType === 'percentage'">
          <NInputNumber v-model:value="form.maxDiscount" :min="0" :step="0.01" placeholder="百分比券封顶金额，空=不封顶" style="width: 200px" />
        </NFormItem>
        <NFormItem label="可被领取">
          <NSwitch v-model:value="form.claimable" />
        </NFormItem>
        <NFormItem label="发放总量">
          <NInputNumber v-model:value="form.totalStock" :min="0" placeholder="空 = 不限" style="width: 200px" />
        </NFormItem>
        <NFormItem label="每人限领">
          <NInputNumber v-model:value="form.perUserLimit" :min="1" style="width: 160px" />
        </NFormItem>
        <NFormItem label="领取周期">
          <NSelect v-model:value="form.claimPeriod" :options="claimPeriodOptions" style="width: 200px" />
        </NFormItem>
        <NFormItem label="最低会员等级">
          <NInputNumber v-model:value="form.minMemberLevel" :min="0" style="width: 160px" />
          <span style="margin-left:8px;color:#999;">0=不限；数字越大等级越高(对应会员等级序号)</span>
        </NFormItem>
```
并把「优惠值」项的 placeholder 改清楚：
```html
        <NFormItem label="优惠值">
          <NInput v-model:value="form.discountValue" placeholder="固定金额填元数(如5);百分比填整数(如10=立减10%)" />
        </NFormItem>
```

- [ ] **Step 4: 构建 + 手动验证**

`pnpm build` 成功。`pnpm dev` 新建一个 percentage + claimable 模板，保存后编辑回填正确，刷新列表后值持久。

- [ ] **Step 5: Commit**

```bash
git add soybean-admin-temp/src/views/coupons/templates/form/index.vue
git commit -m "feat(admin): v1.1.0 模板表单加可领取/库存/限领/周期/等级门槛/百分比封顶"
```

---

## Task 9: 模板列表加「可领取 / 已领·库存」列 + 百分比标签

**Files:**
- Modify: `soybean-admin-temp/src/views/coupons/templates/list/index.vue:23-29,31-68`

- [ ] **Step 1: discountTypeMap 加百分比**

In `list/index.vue`，`discountTypeMap`（L23-29）加：
```ts
  percentage: '百分比折扣',
```

- [ ] **Step 2: 加列**

在 `columns` 数组「有效天数」列之后、「状态」列之前插入：
```ts
  {
    title: '可领取', key: 'claimable', width: 80, align: 'center',
    render(row) {
      return row.claimable
        ? h(NTag, { type: 'success', size: 'small', bordered: false }, () => '可领')
        : h(NTag, { type: 'default', size: 'small', bordered: false }, () => '否');
    }
  },
  {
    title: '已领/库存', key: 'stock', width: 100, align: 'center',
    render(row) {
      const stock = row.totalStock == null ? '∞' : row.totalStock;
      return `${row.claimedCount ?? 0}/${stock}`;
    }
  },
```

- [ ] **Step 3: 构建 + 手动验证**

`pnpm build` 成功。列表显示「可领取」标签与「已领/库存」（不限库存显示 `N/∞`）；percentage 模板优惠类型列显示「百分比折扣」。

- [ ] **Step 4: Commit**

```bash
git add soybean-admin-temp/src/views/coupons/templates/list/index.vue
git commit -m "feat(admin): v1.1.0 模板列表加可领取/已领·库存列+百分比类型标签"
```

---

# Phase 3 — 小程序（miniprogram）

## Task 10: 新建「领券中心」页

**Files:**
- Create: `miniprogram/pages/claim-center/claim-center.js`
- Create: `miniprogram/pages/claim-center/claim-center.json`
- Create: `miniprogram/pages/claim-center/claim-center.wxml`
- Create: `miniprogram/pages/claim-center/claim-center.wxss`

**Interfaces:**
- Consumes: `GET /coupons/claimable`、`POST /coupons/claim`（Task 3）；`utils/layout.getBackBtnTopBar`、`utils/api.api`。

- [ ] **Step 1: 写 .json**

Create `claim-center.json`:
```json
{
  "navigationStyle": "custom",
  "navigationBarTitleText": "领券中心",
  "usingComponents": {}
}
```

- [ ] **Step 2: 写 .js**

Create `claim-center.js`:
```js
const { getBackBtnTopBar } = require('../../utils/layout');
const { api } = require('../../utils/api');

const REASON_TEXT = {
  ok: '立即领取',
  out_of_stock: '已领完',
  reach_limit: '已达上限',
  level_too_low: '等级不足',
  not_claimable: '不可领取',
};

Page({
  data: {
    statusBarHeight: 44,
    topBarTotalHeight: 80,
    loading: true,
    coupons: [],
    claiming: 0,
  },

  onLoad() {
    this.setData(getBackBtnTopBar());
    this.loadClaimable();
  },

  loadClaimable() {
    this.setData({ loading: true });
    api.get('/coupons/claimable').then(res => {
      if (res.code === 0) {
        const coupons = (res.data || []).map(c => ({
          ...c,
          btnText: REASON_TEXT[c.reason] || (c.canClaim ? '立即领取' : '不可领取'),
          stockText: c.remainingStock == null ? '不限量' : ('剩' + c.remainingStock + '张'),
        }));
        this.setData({ coupons });
      }
    }).catch(() => {}).then(() => this.setData({ loading: false }));
  },

  onClaim(e) {
    const id = e.currentTarget.dataset.id;
    const target = this.data.coupons.find(c => c.id === id);
    if (!target || !target.canClaim || this.data.claiming) return;
    this.setData({ claiming: id });
    api.post('/coupons/claim', { templateId: id }).then(res => {
      if (res.code === 0) {
        wx.showToast({ title: '领取成功', icon: 'success' });
        this.loadClaimable();
      } else {
        wx.showToast({ title: res.message || '领取失败', icon: 'none' });
      }
    }).catch(() => {
      wx.showToast({ title: '领取失败，请重试', icon: 'none' });
    }).then(() => this.setData({ claiming: 0 }));
  },

  onBack() {
    wx.navigateBack({ delta: 1 });
  },
});
```

- [ ] **Step 3: 写 .wxml**

Create `claim-center.wxml`:
```html
<view class="page-container">
  <!-- 顶栏（带返回） -->
  <view class="top-bar" style="padding-top: {{statusBarHeight}}px;">
    <view class="top-bar-inner">
      <view class="back-btn" bindtap="onBack"><text class="back-icon">‹</text></view>
      <text class="top-title">领券中心</text>
      <view class="back-btn-placeholder"></view>
    </view>
  </view>

  <scroll-view scroll-y class="claim-scroll" enhanced show-scrollbar="{{false}}"
    style="height: calc(100vh - {{topBarTotalHeight}}px);">
    <view wx:if="{{coupons.length > 0}}" class="coupon-list">
      <view wx:for="{{coupons}}" wx:key="id" class="claim-card {{item.canClaim ? '' : 'disabled'}}">
        <view class="claim-left" style="background: {{item.color}}">
          <text class="claim-value">{{item.value}}</text>
          <text class="claim-min" wx:if="{{item.minSpend > 0}}">满{{item.minSpend}}可用</text>
        </view>
        <view class="claim-mid">
          <text class="claim-name">{{item.name}}</text>
          <text class="claim-desc">{{item.desc}}</text>
          <view class="claim-tags">
            <text class="claim-tag">{{item.stockText}}</text>
            <text class="claim-tag" wx:if="{{item.minMemberLevel > 0}}">需等级{{item.minMemberLevel}}+</text>
            <text class="claim-tag" wx:if="{{item.claimPeriod === 'weekly'}}">每周限{{item.perUserLimit}}</text>
            <text class="claim-tag" wx:if="{{item.claimPeriod === 'monthly'}}">每月限{{item.perUserLimit}}</text>
          </view>
        </view>
        <view class="claim-btn {{item.canClaim ? '' : 'claim-btn-off'}}" bindtap="onClaim" data-id="{{item.id}}">
          <text>{{item.btnText}}</text>
        </view>
      </view>
      <view style="height: calc(40rpx + env(safe-area-inset-bottom))"></view>
    </view>

    <view wx:elif="{{!loading}}" class="empty-state">
      <text class="empty-icon">🎫</text>
      <text class="empty-text">暂无可领取的优惠券</text>
    </view>
  </scroll-view>
</view>
```

- [ ] **Step 4: 写 .wxss（粘土/玻璃风，对齐用居中防真机错位）**

Create `claim-center.wxss`:
```css
.page-container { min-height: 100vh; }
.top-bar { position: relative; }
.top-bar-inner {
  height: 80rpx; padding: 0 24rpx; display: flex; align-items: center;
  justify-content: space-between;
}
.back-btn, .back-btn-placeholder { width: 64rpx; height: 64rpx; display: flex; align-items: center; justify-content: center; }
.back-icon { font-size: 56rpx; color: var(--color-on-surface); line-height: 1; }
.top-title { font-size: 34rpx; font-weight: var(--font-weight-bold); color: var(--color-on-surface); }

.claim-scroll { width: 100%; }
.coupon-list { padding: 24rpx; }

.claim-card {
  display: flex; align-items: center;
  background: var(--glass-bg-card);
  border-radius: var(--radius-card);
  box-shadow: var(--glass-shadow-card);
  margin-bottom: 24rpx; overflow: hidden;
}
.claim-card.disabled { opacity: 0.6; }

.claim-left {
  width: 180rpx; flex-shrink: 0; align-self: stretch;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 28rpx 0; color: #fff;
}
.claim-value { font-size: 34rpx; font-weight: var(--font-weight-bold); }
.claim-min { font-size: 20rpx; margin-top: 8rpx; opacity: 0.9; }

.claim-mid { flex: 1; padding: 24rpx; display: flex; flex-direction: column; }
.claim-name { font-size: 30rpx; font-weight: var(--font-weight-semibold); color: var(--color-on-surface); }
.claim-desc { font-size: 22rpx; color: var(--color-on-surface-variant); margin-top: 6rpx; }
.claim-tags { display: flex; flex-wrap: wrap; gap: 10rpx; margin-top: 14rpx; }
.claim-tag {
  font-size: 20rpx; color: var(--color-primary);
  background: var(--glass-bg-primary-light); border-radius: var(--radius-sm);
  padding: 4rpx 12rpx;
}

.claim-btn {
  flex-shrink: 0; margin-right: 24rpx;
  padding: 14rpx 24rpx; border-radius: var(--radius-full);
  background: var(--color-primary); color: #fff; font-size: 24rpx;
}
.claim-btn-off { background: #c8c2bb; }

.empty-state { padding-top: 200rpx; display: flex; flex-direction: column; align-items: center; }
.empty-icon { font-size: 96rpx; }
.empty-text { font-size: 26rpx; color: var(--color-on-surface-variant); margin-top: 24rpx; }
```
> 若某 CSS 变量在 `app.wxss` 不存在（如 `--glass-bg-primary-light`），改用就近存在的 token 或字面量 `#FBEDE9`。先 grep `app.wxss` 确认变量名再写。

- [ ] **Step 5: 验证（开发者工具）**

`app.json` 暂未注册此页（Task 11 做）。先临时把 `"pages/claim-center/claim-center"` 加到 app.json pages 末尾以便预览；编译后用 `wx.navigateTo({url:'/pages/claim-center/claim-center'})`（可在 main 页临时调）打开：列表渲染、领取成功 toast + 刷新、禁用态显示对应文案、返回键工作。（此临时注册在 Task 11 会正式落定，不必回退。）

- [ ] **Step 6: Commit**

```bash
git add miniprogram/pages/claim-center
git commit -m "feat(miniprogram): v1.1.0 新增领券中心页(列表/领取/库存·限领·门槛状态)"
```

---

## Task 11: 接线领券中心入口（app.json + 会员横幅 + routes/actions）

**Files:**
- Modify: `miniprogram/app.json:2-12`（pages）
- Modify: `miniprogram/pages/main/main.wxml:261-269`（会员横幅）
- Modify: `miniprogram/pages/main/main.js:669-684`（routes + 加 onClaimCenter）
- Modify: `miniprogram/pages/profile/profile.js:56-69`（actions）

- [ ] **Step 1: app.json 注册页面**

In `app.json` pages 数组末尾（`pages/recharge/recharge` 后）加：
```json
    "pages/recharge/recharge",
    "pages/claim-center/claim-center"
```

- [ ] **Step 2: 会员横幅可点进领券中心**

In `main.wxml`，`.coupon-banner`（L261）加 `bindtap`，并去掉只在 help 上的 tap（保留 help 图标但整条可点）：
```html
        <view class="coupon-banner" bindtap="onClaimCenter">
          <view class="coupon-banner-left">
            <text class="coupon-banner-icon">🎫</text>
            <text class="coupon-banner-text">会员每周可领取优惠券</text>
          </view>
          <view class="coupon-banner-help">
            <text class="coupon-help-icon">›</text>
          </view>
        </view>
```

- [ ] **Step 3: main.js 加 route + 方法**

In `main.js` `onMenuItem` 的 `routes`（L669-676）加一项：
```js
      recharge: '/pages/recharge/recharge',
      claimcenter: '/pages/claim-center/claim-center',
```
并在 `onMenuItem` 方法之后加：
```js
  onClaimCenter() {
    wx.navigateTo({ url: '/pages/claim-center/claim-center' });
  },
```

- [ ] **Step 4: profile.js actions 同步**

In `profile.js` `onMenuItem` 的 `actions`（L56-69）加：
```js
      recharge: '/pages/recharge/recharge',
      claimcenter: '/pages/claim-center/claim-center',
```

- [ ] **Step 5: 验证**

开发者工具：进入「会员」tab，点优惠券信息条 → 跳转领券中心；返回正常。

- [ ] **Step 6: Commit**

```bash
git add miniprogram/app.json miniprogram/pages/main/main.wxml miniprogram/pages/main/main.js miniprogram/pages/profile/profile.js
git commit -m "feat(miniprogram): v1.1.0 会员横幅→领券中心入口+app.json/routes/actions同步"
```

---

## Task 12: 结账折扣与后端对齐（percentage + half_price）

**Files:**
- Modify: `miniprogram/pages/main/main.js:386-404`（recalcPrice switch）

- [ ] **Step 1: 修 recalcPrice switch**

In `main.js` `recalcPrice` 的 `switch (coupon.discountType)`（L386-404）替换 `half_price` 分支并新增 `percentage`：
```js
        case 'fixed_amount':
          couponDiscount = parseFloat(coupon.discountValue) || 0;
          break;
        case 'percentage': {
          const pct = parseFloat(coupon.discountValue) || 0;
          couponDiscount = cartTotal * pct / 100;
          if (coupon.maxDiscount != null) couponDiscount = Math.min(couponDiscount, parseFloat(coupon.maxDiscount));
          break;
        }
        case 'buy_one_get_one': {
          const items = Object.values(app.globalData.cart);
          if (items.length > 0) couponDiscount = Math.min(...items.map(i => i.price));
          break;
        }
        case 'half_price': {
          const items = Object.values(app.globalData.cart);
          if (items.length > 0) {
            const cheapest = items.reduce((min, i) => i.price < min.price ? i : min, items[0]);
            couponDiscount = cheapest.price * 0.5 * cheapest.quantity;
          }
          break;
        }
        case 'free_delivery':
          couponDiscount = 0;
          break;
```
（`coupon.maxDiscount` 来自 Task 5 的 `formatCoupon`，经 `fetchAvailableCoupons` 的 `...c` 展开保留。）

- [ ] **Step 2: 验证**

开发者工具：领一张 percentage 券（10%、封顶15），购物车小计 200 → 结账选择器选中后「优惠券减免」显示 15.00；小计 100 时显示 10.00。half_price 券显示 = 最低价件×0.5×数量。下单成功（服务端复算一致）。

- [ ] **Step 3: Commit**

```bash
git add miniprogram/pages/main/main.js
git commit -m "fix(miniprogram): v1.1.0 结账折扣对齐后端-新增percentage(封顶)+half_price最低价件"
```

---

# 收尾

- [ ] **全量自检**：grep 全仓 `product_id`（确认 orderController 不再用 `coupon.product_id`）；`coupon-templates`（确认后台 view 不再有 `/coupon-templates/` 死链）。
- [ ] **推送**（按 auto-commit-push 习惯）：`git push`（偶发 openssl `unexpected eof` 重试一次）。
- [ ] **部署（需用户授权，独立步骤）**：`python soybean-admin-temp/deploy.py backend` →（前端先 `pnpm build`）`python soybean-admin-temp/deploy.py frontend`；小程序在微信开发者工具手动上传发布。

## 验证清单（对应 spec 第 6 节）
1. 后端 `npm run dev` 干净启动；claimable/claim/assign/百分比下单 curl 全绿；并发库存不超发；周期限领、等级门槛拒绝正确。
2. 后台 `pnpm build` 通过；模板新建/编辑/删除不再死链；表单存得下新字段；列表显示可领取 + 已领/库存。
3. 小程序领券中心列表/领取/禁用态正常；会员横幅可进入；结账 percentage(封顶)/half_price 折扣显示与后端一致。

## 未纳入本计划（显式，对齐 spec）
- 兑换券接入下单流程 / 到店核销改造。
- 会员升级奖励券（`member_tiers.coupon_value`）。
- 后台完整「领取记录」日志视图（本计划仅在模板列表显示已领计数）。
