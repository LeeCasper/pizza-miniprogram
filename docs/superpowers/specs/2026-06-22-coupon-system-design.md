# 优惠券系统完善 — 设计文档

- 日期：2026-06-22
- 范围：贯穿三端（pizza-server / soybean-admin-temp / miniprogram）
- 目标（用户确认全选）：① 修好后台模板管理 ② 加用户主动领取 ③ 修后端折扣与发放隐患 ④ 丰富模板能力
- 入口决策：用户领取走**独立「领券中心」页**
- 本轮不动：兑换券（redeem）核销流程保持现状（到店核销 + `PUT /coupons/:id/use`）

---

## 0. 现状速览（探查结论）

**已能用**：后台模板 CRUD 接口 + 列表/表单页；后台「发放优惠券」群发；小程序结账选优惠券（discount 类，下单传 `couponId`，服务端按类型算折扣并叠加会员折扣）；积分兑换铸券；退款还原券；每日 02:00 定时过期。

**缺口 / bug**：
1. 后台模板管理 nav 全是死链（列表/表单跳 `/coupon-templates/...`，路由实际在 `/coupons/templates/...`）→ 后台当前无法增删改模板。
2. 用户无法主动领取（券只能被动获得；"会员每周可领取优惠券"是假入口）。
3. 模板能力薄：无百分比折扣；无库存/每人限领/领取门槛。
4. 后端隐患：`half_price` 引用不存在的 `coupon.product_id`（永远命中第一件）；群发非事务循环 INSERT、无去重/限领；模板与群发接口无参数校验。

---

## 1. 数据模型

新增迁移文件 `pizza-server/db/migrate_coupon_claimable.sql`，并**手动登记进 `soybean-admin-temp/deploy.py` 的硬编码迁移清单**。生产 MySQL 不支持 `ADD COLUMN IF NOT EXISTS` → 用普通 `ADD COLUMN`（重复执行只产生无害 Duplicate-column 警告）。

### ① `coupon_templates` 加字段
```sql
ALTER TABLE coupon_templates
  ADD COLUMN claimable        TINYINT(1)   NOT NULL DEFAULT 0,   -- 是否在领券中心可领
  ADD COLUMN total_stock      INT UNSIGNED NULL,                 -- 总发放量；NULL=不限
  ADD COLUMN claimed_count    INT UNSIGNED NOT NULL DEFAULT 0,   -- 已领（原子扣减）
  ADD COLUMN per_user_limit   INT UNSIGNED NOT NULL DEFAULT 1,   -- 每人限领
  ADD COLUMN claim_period     ENUM('none','weekly','monthly') NOT NULL DEFAULT 'none',
  ADD COLUMN min_member_level INT          NOT NULL DEFAULT 0,   -- 最低会员等级(对应 member_tiers.level_index)；0=不限
  ADD COLUMN max_discount     DECIMAL(10,2) NULL;                -- 百分比折扣封顶（仅 percentage）

ALTER TABLE coupon_templates
  MODIFY COLUMN discount_type ENUM('free_redeem','buy_one_get_one','free_delivery','half_price','fixed_amount','percentage')
  DEFAULT 'fixed_amount';
```
`claim_period` 语义：`none`=累计限领 `per_user_limit` 张；`weekly`/`monthly`=每周期限 `per_user_limit` 张。

### ② `coupons` 加字段（券为快照，需带来源 + 封顶）
```sql
ALTER TABLE coupons
  ADD COLUMN template_id  INT UNSIGNED  NULL,    -- 回溯来源模板
  ADD COLUMN max_discount DECIMAL(10,2) NULL;    -- 百分比封顶快照
ALTER TABLE coupons
  MODIFY COLUMN discount_type ENUM('free_redeem','buy_one_get_one','free_delivery','half_price','fixed_amount','percentage') NULL;
```

### ③ 新表 `coupon_claims`（领取记录 = 周期限领依据 + 可审计）
```sql
CREATE TABLE IF NOT EXISTS coupon_claims (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  template_id INT UNSIGNED NOT NULL,
  user_id     INT UNSIGNED NOT NULL,
  coupon_id   INT UNSIGNED NOT NULL,            -- 不设 FK（绕开软删子行+券清理连带）
  period_key  VARCHAR(16)  NOT NULL DEFAULT '', -- none→''; weekly→'2026-W25'; monthly→'2026-06'
  claimed_at  DATETIME     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (template_id) REFERENCES coupon_templates(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)     REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_tpl_user_period (template_id, user_id, period_key)
);
```

**取舍**：库存用原子 `UPDATE … WHERE claimed_count<total_stock` 守卫防超发；限领按 `(template_id,user_id,period_key)` 计数。模板为软删（`is_active=0`），FK 永不触发 1451；`coupon_id` 故意不设 FK。**管理员群发**走单独直发路径：事务化 mint，但不占 `claimed_count`、不校验限额（人工 override）；`claimed_count` 只反映用户自助领取量。

---

## 2. 后端（pizza-server）

### 新增 `src/services/couponClaimService.js`
- `mintCouponFromTemplate(conn, tpl, userId, source)` — 共用事务化铸券器：算 `valid_from/valid_to`、生成唯一 `code`、`INSERT coupons`（带 `template_id`/`max_discount`/`discount_type` 快照），返回新券。领取与群发共用。
- `computePeriodKey(claim_period, date)` — `none→'' / weekly→'YYYY-Www'(ISO 周) / monthly→'YYYY-MM'`（服务端本地时间）。
- `listClaimable(userId)` — 取 `is_active=1 AND claimable=1` 模板，逐条标注 `remainingStock`(NULL=不限)、`claimedInPeriod`、`canClaim`、`reason`(`out_of_stock`/`reach_limit`/`level_too_low`/`ok`)。会员等级**优先用服务端 `member_level`**，不本地推算。
- `claim(userId, templateId)` — 单事务：① `SELECT … FOR UPDATE` 锁模板，校验 `is_active && claimable`；② 等级门槛；③ 按 `period_key` 统计领取数 < `per_user_limit`；④ 原子库存守卫，`affectedRows=0`→库存不足回滚；⑤ `mintCouponFromTemplate`；⑥ `INSERT coupon_claims`；⑦ commit。

### 改 `src/controllers/adminApiController.js`
- `assignCoupon` 包进单事务，循环内调 `mintCouponFromTemplate`，部分失败整体回滚；不动 `claimed_count`/限额。
- 模板 create/update 接收并透传新字段（camel→snake：`totalStock→total_stock` 等）。

### 路由 `src/routes/coupons.js`（均在 `auth` 之后）
- `GET  /api/v1/coupons/claimable` → `listClaimable`
- `POST /api/v1/coupons/claim` `{templateId}` → `claim`

### 校验 `src/middleware/validation.js`（新增 Joi 并挂到路由）
- `couponTemplateSchema`（create/update，含新字段 + `percentage` 入 `discountType` 白名单）
- `claimSchema`（`{templateId}`）、`assignSchema`（`{templateId, userIds[]}`）

### 折扣修复 `src/controllers/orderController.js`
- `half_price`：删除 `coupon.product_id`，改**最低价商品半价**（与 `buy_one_get_one` 同取数，确定性）。
- 新增 `percentage`：`discount = total * discount_value/100`；`max_discount` 非空则 `discount = min(discount, max_discount)`。
- 券行已带 `discount_value(%)`+`max_discount` 快照，结账/退款一致。

---

## 3. 后台（soybean-admin-temp）

- **修死链**：`views/coupons/templates/list/index.vue`(L62、L151)、`templates/form/index.vue`(L82、L91) 的 `/coupon-templates/...` → `/coupons/templates/...`。
- 改后跑 `pnpm gen-route` 重生 `router/elegant/{transform.ts,routes.ts}` 与 `typings/elegant-router.d.ts`（补 `coupons_templates_create/_edit`）。
- 删 `locales/langs/{zh-cn,en-us}.ts` 中孤儿 `couponTemplates*`（camelCase）键。
- `service/api/couponTemplate.ts`：`CouponTemplate` 接口补 `claimable/totalStock/claimedCount/perUserLimit/claimPeriod/minMemberLevel/maxDiscount`，`discountType` 加 `'percentage'`；把 `fetchAssignCoupon` 移到 `coupon.ts`，并给 `coupon.ts` 补 `Coupon` 接口（现为裸 `any`）。
- 模板表单（`templates/form/index.vue`）：加「可领取」开关、发放总量(空=不限)、每人限领、领取周期(none/weekly/monthly)、最低会员等级(NSelect 取自会员等级)、`percentage` 时显示折扣百分比 + 封顶输入。
- 模板列表（`templates/list/index.vue`）：加「已领/库存」「可领取」标签列。

---

## 4. 小程序（miniprogram）

### 新页 `pages/claim-center/`（claim-center.{js,wxml,wxss,json}）
- `navigationStyle:custom` + 标题「领券中心」；顶栏用 `utils/layout.js` 带返回键变体；遵 app.wxss 玻璃设计。
- 列出可领模板（`api.get('/coupons/claimable')`），卡片展示券面 / 门槛(满X可用·会员等级) / 库存或限领状态 / 领取按钮（领完·已达上限·等级不足 → 禁用并显原因）。
- 领取 `api.post('/coupons/claim',{templateId})`，成功 toast + 刷新；乐观更新放在 async 调用**之前**。

### 导航接线（遵 CLAUDE.md 四处同步）
- 会员页「会员每周可领取优惠券」横幅 → `navigateTo` 领券中心。
- `app.json` pages 增项；`pages/main/main.js` `routes` 与 `pages/profile/profile.js` `actions` 增 `claimcenter`；新建页 `.json`。

### 结账 `pages/main/main.js recalcPrice`
- 镜像后端：补 `percentage`(含封顶) 与确定性 `half_price`。领到的新券随 `GET /coupons?category=discount&status=available` 自然进结账选择器（已通）。

---

## 5. 错误处理与边界

- 领取失败返回结构化 400 + `reason` 码；小程序映射中文 toast。
- 原子库存守卫（`affectedRows` 判定）防并发超发；`FOR UPDATE` 锁模板防限额竞态（沿用 Phase1 范式）。
- 退款沿用现有 `_restoreCoupon`（券回 `available`）；**不回退库存/领取计数**（领取已发生），语义一致。
- 周期边界用服务端本地时间算 `period_key`；铸券 `valid_to=今日+valid_days`。
- 会员等级门槛优先用服务端 `member_level` 字段。

---

## 6. 测试与验证 / 部署

**测试**
- 后端 curl：领取正常 / 库存耗尽(并发) / 每周限领 / 等级不足拒绝 / 结账 `percentage`(+封顶) / `half_price`=最低价件；`npm run dev` 干净启动；迁移可重复执行。
- 后台：`pnpm build` 通过；模板增删改不再死链；表单存得下新字段；列表显示已领/库存。
- 小程序：开发者工具——领券中心列表/领取/禁用态、结账新券与 `percentage` 折扣显示。

**部署（单独、需用户授权步骤；本任务只写代码 + 带版本号 commit）**
- 后端 `python soybean-admin-temp/deploy.py backend`（迁移 + pm2 重启；先把 `migrate_coupon_claimable.sql` 登记进 deploy.py 清单）。
- 后台 `pnpm build` + `python soybean-admin-temp/deploy.py frontend`。
- 小程序改动需在微信开发者工具手动上传发布。

---

## 变更总览

| 子项目 | 文件 |
|---|---|
| pizza-server | 新增 `db/migrate_coupon_claimable.sql`、`src/services/couponClaimService.js`；改 `db/schema.sql`(同步新结构)、`src/routes/coupons.js`、`src/controllers/{orderController,adminApiController}.js`、`src/middleware/validation.js`、`src/services/couponTemplateService.js`(透传新字段) |
| soybean-admin | 改 `views/coupons/templates/{list,form}/index.vue`、`service/api/{couponTemplate,coupon}.ts`、`locales/langs/{zh-cn,en-us}.ts`；`pnpm gen-route` 重生 `router/elegant/{transform,routes}.ts`、`typings/elegant-router.d.ts` |
| miniprogram | 新增 `pages/claim-center/*`；改 `app.json`、`pages/main/main.js`、`pages/profile/profile.js`、会员横幅 WXML、`pages/main/main.js recalcPrice` |

## 未纳入本轮（显式）
- 兑换券（redeem）接入下单流程 / 到店核销改造。
- 会员升级奖励券（`member_tiers.coupon_value` 仍未接线）。
- 后台「领取记录」完整日志视图（本轮仅在模板列表显示已领计数）。
