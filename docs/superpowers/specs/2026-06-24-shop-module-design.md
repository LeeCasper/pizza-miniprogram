# 会员商城模块设计 (Shop Module Design)

**Goal:** 在披萨小程序上挂一个与点单系统物理隔离的轻量电商模块：独立商城商品目录、收藏、商品详情页、实物邮寄下单、微信/余额支付、独立商城订单，后台可配置商城分类/商品并发货。

**Architecture:** 全新独立的 5 张表 + `/shop/*` 后端命名空间 + 后台「商城管理」一级菜单 + 小程序新增详情/收藏/商城订单页。与点单系统**只共用**：用户体系、收货地址表、微信支付/余额工具、图片上传、黏土风 UI 令牌。商城商品**不进购物车**、商城订单**不进点单订单列表**。

**Tech Stack:** Express.js + MySQL (mysql2 pool, utf8mb4) · Soybean Admin (Vue3 + NaiveUI) · WeChat Mini Program (WXML/WXSS/JS) · 微信支付 v3 JSAPI。

---

## Global Constraints

- **黏土风 UI**：所有小程序新页面复用 `app.wxss` 的 `--glass-*` / `--radius-*` / `--color-*` 令牌；**禁止任何 `backdrop-filter`**（切前台重栅格化导致闪屏，见 memory `theme-reapply-onshow-flicker`）。
- **WXSS 限制**：禁用 `background` 简写带 `/`；背景图用绝对定位 `<image>` 标签而非 CSS `url()`；rpx 为主单位；新页面必须有 `.json` 且 `"navigationStyle": "custom"` + 页面标题。
- **新增小程序页面**必须同步：`app.json` pages、主页 `main.js` 的 `routes`、`profile.js` 的 `actions`（凡需 navigateTo 的入口）。
- **新增后台页面**必须走 CLAUDE.md 的 7 步：view 文件 → `routes/index.ts`（**route name 全小写**，否则菜单重复）→ `elegant/imports.ts` → `elegant/transform.ts` → `typings/elegant-router.d.ts` → i18n（zh-cn/en-us 的 `route` 段）→ `service/api` 并在 `index.ts` 导出。
- **迁移**：新表与 `ALTER` 写进 `pizza-server/db/migrate_shop_module.sql`（幂等：建表 `IF NOT EXISTS`；生产 MySQL **不支持** `ADD COLUMN IF NOT EXISTS`，改列用 `MODIFY COLUMN`）；同步 `db/schema.sql`；并把新迁移文件路径追加进 `soybean-admin-temp/deploy.py` 的迁移清单（硬编码，须手动加）。
- **软删 FK 安全**：商城商品软删（`is_deleted=1`），订单明细对 `shop_product_id` 用快照 + 可空 FK，删商品不破历史订单。
- **审计**：下单/支付/退款/发货走 `auditService`（fire-and-forget，永不抛）。
- **Node 版本**：构建后台需 `$env:PATH = "C:\Program Files\nodejs;" + $env:PATH`（覆盖默认 v18）。

---

## Out of Scope (YAGNI)

多规格 SKU 变体、商城商品用积分支付、商城订单用优惠券、商品评价/评分、商城搜索、多商品合并下单（无购物车，立即购买恒为单商品）。

---

## Phasing（分两批交付）

- **第一期 — 目录 + 浏览 + 收藏 + 详情**：表 `shop_categories` / `shop_products` / `shop_favorites`；后端商品/分类/收藏 API；后台商城商品 + 商城分类管理；小程序商城列表改数据源 + 去购物车 + 卡片收藏 + 详情页 + 收藏页。**验收：能逛、能收藏、能看详情，暂不能买。**
- **第二期 — 购买 + 支付 + 订单 + 发货**：表 `shop_orders` / `shop_order_items`；下单/支付/退款/确认收货 API + 微信回调路由 + 未付款自动关单；后台商城订单管理 + 发货；小程序立即购买流程 + 商城订单页。**验收：完整下单到收货。**

---

## 数据模型（5 张新表）

### shop_categories（商城分类，替代硬编码 `SHOP_CATEGORIES`）
| 列 | 类型 | 说明 |
|---|---|---|
| `key` | VARCHAR(30) PK | 分类标识，正则 `^[a-z0-9_]+$` |
| `name` | VARCHAR(50) NOT NULL | 显示名 |
| `icon` | VARCHAR(500) | 图片 URL（后台 ImageUpload 上传） |
| `sort_order` | INT DEFAULT 0 | 排序 |
| `is_active` | TINYINT(1) DEFAULT 1 | 启用 |
| `created_at`/`updated_at` | TIMESTAMP | |

### shop_products（商城商品）
| 列 | 类型 | 说明 |
|---|---|---|
| `id` | INT UNSIGNED PK AUTO_INCREMENT | |
| `shop_category_key` | VARCHAR(30) NULL | FK → `shop_categories(key)`，可空（分类删除/未归类兜底） |
| `name` | VARCHAR(100) NOT NULL | |
| `subtitle` | VARCHAR(200) | 短描述/卖点 |
| `price` | DECIMAL(10,2) NOT NULL | 售价 |
| `original_price` | DECIMAL(10,2) NULL | 划线原价 |
| `main_image` | VARCHAR(500) | 封面/列表主图 |
| `images` | JSON | 轮播图 URL 数组（详情页） |
| `detail_desc` | TEXT | 详情文字描述（纯文本/多行，非富文本） |
| `stock` | INT NOT NULL DEFAULT 0 | 库存 |
| `sales` | INT NOT NULL DEFAULT 0 | 销量（展示用，付款成功 +qty） |
| `tag` | VARCHAR(30) | 人气/新品/限定 等 |
| `is_available` | TINYINT(1) DEFAULT 1 | 上下架 |
| `sort_order` | INT DEFAULT 0 | 排序 |
| `is_deleted` | TINYINT(1) NOT NULL DEFAULT 0 | 软删 |
| `created_at`/`updated_at` | TIMESTAMP | |
| | INDEX `idx_shop_cat`(shop_category_key), `idx_shop_avail`(is_available) | |

### shop_favorites（收藏）
| 列 | 类型 | 说明 |
|---|---|---|
| `id` | INT UNSIGNED PK AUTO_INCREMENT | |
| `user_id` | INT UNSIGNED NOT NULL | FK → `users(id)` |
| `shop_product_id` | INT UNSIGNED NOT NULL | FK → `shop_products(id)` |
| `created_at` | TIMESTAMP | |
| | UNIQUE KEY `uniq_user_product`(user_id, shop_product_id) | 幂等收藏 |

### shop_orders（商城订单，独立于 `orders`）
| 列 | 类型 | 说明 |
|---|---|---|
| `id` | VARCHAR(20) PK | 订单号，前缀 `SH` + YYYYMMDD + 3 位序号（区别于点单订单 + 便于回调路由） |
| `user_id` | INT UNSIGNED NOT NULL | FK → `users(id)` |
| `total_amount` | DECIMAL(10,2) NOT NULL | 商品合计（=price×qty） |
| `paid_amount` | DECIMAL(10,2) NOT NULL DEFAULT 0 | 实付 |
| `payment_method` | ENUM('wechat','balance') NULL | NULL=未支付 |
| `status` | ENUM('pending','paid','shipped','completed','cancelled') NOT NULL DEFAULT 'pending' | 见状态机 |
| `recipient_name` | VARCHAR(50) | 收件人快照 |
| `recipient_phone` | VARCHAR(20) | |
| `recipient_address` | VARCHAR(300) | 收货地址平铺快照 |
| `shipping_company` | VARCHAR(50) NULL | 快递公司 |
| `tracking_no` | VARCHAR(50) NULL | 快递单号 |
| `note` | VARCHAR(200) NULL | 备注 |
| `paid_at`/`shipped_at`/`completed_at` | DATETIME NULL | |
| `created_at`/`updated_at` | TIMESTAMP | |
| | INDEX `idx_shop_order_user`(user_id), `idx_shop_order_status`(status) | |

### shop_order_items（商城订单明细，沿用 `order_items` 快照模式）
| 列 | 类型 | 说明 |
|---|---|---|
| `id` | INT UNSIGNED PK AUTO_INCREMENT | |
| `order_id` | VARCHAR(20) NOT NULL | FK → `shop_orders(id)` |
| `shop_product_id` | INT UNSIGNED NULL | FK → `shop_products(id)`，可空（软删安全） |
| `product_name` | VARCHAR(100) NOT NULL | 快照 |
| `product_image` | VARCHAR(500) | 快照主图 |
| `price` | DECIMAL(10,2) NOT NULL | 快照单价 |
| `quantity` | INT NOT NULL | |
| `subtotal` | DECIMAL(10,2) NOT NULL | price×quantity |

> 「立即购买」恒为单商品单行，但仍拆 items 表以与现有 `order_items` 模式一致并保软删快照安全。

---

## 商城订单状态机

```
pending(待付款)   → paid(待发货)      [支付成功：余额即时 / 微信回调]
pending           → cancelled(已取消)  [用户/管理员取消未付款 或 超时自动关单 → 回补库存]
paid(待发货)      → shipped(待收货)    [管理员填快递公司+单号发货]
paid              → cancelled          [用户/管理员取消已付款 → 退款 + 回补库存]
shipped(待收货)   → completed(已完成)  [用户确认收货]
completed         → (终态)
cancelled         → (终态)
```

- **库存扣减时机**：下单创建时（pending）即扣减（与点单一致）；`pending/paid → cancelled` 时回补。
- **销量 `sales`**：支付成功（→paid）时 `+quantity`；取消已付款订单时 `-quantity`。
- **未付款自动关单**：扩展现有「自动关单」cron 覆盖 `shop_orders` 中超 `unpaidTimeoutMinutes` 的 pending 单 → cancelled + 回补库存。

---

## 后端 API（pizza-server，新增 `/shop/*`）

### 路由 / 控制器 / 服务
- 新建 `routes/shop.js`（挂 `/api/v1/shop`，用户态走 `auth`，列表/详情/分类可 optional auth）。
- 新建 `controllers/shopController.js`、`controllers/shopOrderController.js`。
- 新建 `services/shopProductService.js`、`services/shopFavoriteService.js`、`services/shopOrderService.js`。
- 后台 API 在 `routes/adminApi.js` 增 `/admin/shop/*`（`auth` + `adminOnly`），handler 进 `controllers/adminApiController.js`（或新建 `adminShopController.js` 并在 adminApi 挂载）。

### 第一期端点
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/shop/categories` | 启用的商城分类，按 sort_order |
| GET | `/shop/products?category=` | 上架商品列表（`is_available=1 AND is_deleted=0`），可按分类筛 |
| GET | `/shop/products/:id` | 商品详情（含 images 数组、detail_desc；附 `isFavorited` 当带 token） |
| GET | `/shop/favorites` | 我的收藏（join shop_products 取展示字段） |
| POST | `/shop/favorites/:productId` | 收藏（`INSERT ... ON DUPLICATE KEY UPDATE` 幂等） |
| DELETE | `/shop/favorites/:productId` | 取消收藏 |

后台第一期：`GET/POST/PUT/DELETE /admin/shop/products`、`PUT /admin/shop/products/:id/toggle`（上下架）、`GET/POST/PUT/DELETE /admin/shop/categories`（删分类前校验是否仍有商品引用，参照现有 categories 守卫）。

### 第二期端点
| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/shop/orders` | body `{ shopProductId, quantity, addressId, paymentMethod }`：事务内校验上架+库存(`FOR UPDATE`)、扣库存、取地址快照、生成订单号(`SH...`)、插 order+item。余额：同事务校验余额→扣余额→status=paid→写余额流水→返回 `{ orderId, paid:true }`；微信：提交 pending→`wechatPay.payRequest`(out_trade_no=订单号)→返回 `{ orderId, payParams }` |
| GET | `/shop/orders?status=` | 我的商城订单列表 |
| GET | `/shop/orders/:id` | 订单详情（含 items、收件人、快递、状态文案、canCancel） |
| GET | `/shop/orders/:id/status` | 支付状态轮询（供 pay.js） |
| POST | `/shop/orders/:id/confirm` | 确认收货（shipped→completed） |
| POST | `/shop/orders/:id/cancel` | 取消（pending→直接关；paid→退款+回补库存+销量回退） |

后台第二期：`GET /admin/shop/orders`、`GET /admin/shop/orders/:id`、`POST /admin/shop/orders/:id/ship`（body `{ shippingCompany, trackingNo }` → paid→shipped + 写 shipped_at）、`POST /admin/shop/orders/:id/refund`（admin 退款，复用退款逻辑）。

### 支付集成
- 复用 `utils/wechatPay.js`（签名/验签/解密/payRequest）。
- 微信回调 `/pay/notify`：现有 handler 解出 `out_trade_no`，**新增路由分支**——`out_trade_no` 以 `SH` 开头（或查得 `shop_orders`）→ 调 `shopOrderService.markPaid(orderId)`（pending→paid、paid_at、paid_amount、sales+=qty；幂等：已 paid 直接返回成功）。复用既有 `express.raw()` 验签管线，不动点单/充值分支。
- 退款逻辑**自带在 `shopOrderService`**（不改 `refundService`，保持与点单退款隔离），实现方式参照 `refundService`：余额退款=回补余额+写余额流水；微信退款=调 `wechatPay` 退款接口。在 `shopOrderService.cancel` 与 admin refund 内统一调用，**仅恢复库存/销量 + 退款**。

### 共享辅助
- 订单号生成器 `generateShopOrderId(conn, now)`：前缀 `SH` + 日期 + 当日序号（查 `shop_orders` 当日 MAX 序号 +1），独立于点单的 `generateOrderId`。

---

## 后台（soybean-admin-temp）

新增一级菜单 **商城管理**（route name 全小写），3 个子页：

### 商城商品（`views/shop/products/`）
- `list/index.vue`：NDataTable（id/主图/名称/分类/价格/库存/标签/上下架 NSwitch/操作）。仿 `views/products/list`。
- `form/index.vue`：name、subtitle、shop_category_key（下拉，取 `/admin/shop/categories`）、price、original_price、**多图上传**（images 数组）、main_image、detail_desc（textarea）、stock、tag、is_available。仿 `views/products/form`。
- **新组件** `components/common/MultiImageUpload.vue`：基于现有单图 `ImageUpload` 思路 + `fetchUploadImage`，管理 URL 数组（加/删/排序、预览），绑定 `images`。

### 商城分类（`views/shop/categories/`）
- `index.vue`：分类 CRUD 模态。字段 key（编辑时不可改，正则 `^[a-z0-9_]+$`）、name、icon（**ImageUpload 图片**）、sort_order、is_active。仿 `views/products/categories`。删除前若仍有商品引用则后端拒绝。

### 商城订单（`views/shop/orders/`，第二期）
- `list/index.vue`：订单号/用户/合计/支付方式/状态/下单时间/操作。状态 Tag 配色。
- `detail/index.vue`：明细 + 收件人 + 状态时间线；**发货操作**（输入 shippingCompany + trackingNo → ship）；退款操作。

### 服务层
- `service/api/shop.ts`：`fetchShopProducts/fetchShopProduct/fetchCreateShopProduct/fetchUpdateShopProduct/fetchDeleteShopProduct/fetchToggleShopProduct`、`fetchShopCategories/fetchCreateShopCategory/fetchUpdateShopCategory/fetchDeleteShopCategory`、（二期）`fetchShopOrders/fetchShopOrder/fetchShipShopOrder/fetchRefundShopOrder`。在 `service/api/index.ts` 导出。

---

## 小程序（miniprogram）

### 商城列表改造（`pages/shop/` + `pages/main/tpl-shop.wxml`/`main.js`/`main.wxss` 两份同步）
- 数据源：`/products` → `/shop/products`；分类 `SHOP_CATEGORIES`(硬编码) → `/shop/categories`（图片 icon，下划线 tab 渲染 name + 可选小图标）。
- **移除**：加购物车步进器、`app.addToCart`/`decreaseQuantity` 调用、`syncCart`/全局购物车同步（商城不碰购物车）。
- 卡片：整卡 `bindtap` → `wx.navigateTo` 到 `pages/shop-detail`；卡片角标加**收藏 ❤️ 切换**（`catchtap`，调收藏 API，乐观更新）。
- 保留上轮黏土风（hero swiper / 下划线 tab / featured 大卡 / 横向列表卡 / 末尾 spacer / 空状态）。
- main.js 的 `onShopProductTap` 由「弹详情抽屉」改为 navigateTo 详情页；删除 shop 相关的购物车/dietary 逻辑。

### `pages/shop-detail/`（新）
- 顶部多图轮播（`images` 数组，`swiper`）→ name / 价格(+划线原价) / 库存 / 销量 → `detail_desc` 文字 → 吸底栏：收藏 ❤️ + 「立即购买」。
- 点「立即购买」弹**底部确认抽屉**（drawer 模式，参照 address 抽屉模式）：数量步进器 + 收货地址选择（默认地址，点击换地址，**复用现有收货地址 API**，具体端点由实现计划核对；无地址引导去新增）+ 合计 + 支付方式（微信/余额 radio）+ 确认支付。
- 确认 → `POST /shop/orders`；余额已付 → 成功 toast → 跳商城订单页；微信 → `pay.payShopOrder(orderId)` → 成功跳转。
- `.json` 设 custom 导航 + 标题「商品详情」。

### `pages/shop-orders/`（新）
- 商城订单列表，状态徽标 + 快递公司/单号；动作：pending→去支付、shipped→确认收货、pending/paid→取消。`.json` custom 导航 + 标题「商城订单」。

### `pages/favorites/`（新）
- 收藏的商城商品列表（取 `/shop/favorites`），卡片点击进详情、可取消收藏。**接管**现 `profile.js:63` 与 `main.js` `routes` 里指向地址页的死链 `favorites` → 改指 `/pages/favorites/favorites`。`.json` custom 导航 + 标题「我的收藏」。

### utils
- `utils/pay.js` 新增 `payShopOrder(orderId)`：镜像 `payOrder`，轮询 `/shop/orders/:id/status`。
- 收藏 API 调用直接走 `utils/api.js` 的 `api`，无需新模块；可在小程序侧加薄封装 `utils/shop.js`（可选）。

---

## 迁移与部署

- 新建 `pizza-server/db/migrate_shop_module.sql`：5 表 `CREATE TABLE IF NOT EXISTS`；二期表也一并写入（一次建全，分期只是代码/页面分批）。同步 `db/schema.sql`。
- `soybean-admin-temp/deploy.py` 迁移清单末尾追加 `'pizza-server/db/migrate_shop_module.sql'`（注意 deploy.py 结尾 `✓` 在 GBK 控制台可能崩，看 OK 行判断成功，见 memory `deploy-migration-gotchas`）。
- 后端：迁移 + `python soybean-admin-temp/deploy.py backend`。
- 后台：`$env:PATH=...` → `pnpm build` → `deploy.py frontend`。
- 小程序：微信开发者工具上传。
- 沿用项目自动 commit-push 习惯，带版本号。

---

## 验证要点

1. **DB**：迁移后 5 表存在；`shop_orders.payment_method` 枚举、`shop_order_items.shop_product_id` 可空。
2. **一期**：后台建分类(图标)→建商品(多图/库存)→小程序商城列表读到新数据、无购物车按钮、卡片可收藏、点进详情轮播正常；收藏页列出、可取消；「我的收藏」入口指向新页。
3. **二期**：详情页立即购买→选地址+数量+支付方式→余额单即时 paid、微信单回调后 paid；库存 -qty、销量 +qty；商城订单页出现且状态正确；后台发货填单号→shipped；小程序确认收货→completed；取消已付款单→退款+库存回补+销量回退；超时未付款自动关单回补库存。
4. **隔离**：商城下单不进点单订单列表、不动购物车；点单流程不受影响。
