# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"王姐手工披萨" — a pizza ordering WeChat Mini Program with a Node.js backend and Soybean Admin management panel. Three sub-projects:

| Directory | Role | Stack |
|-----------|------|-------|
| `miniprogram/` | WeChat Mini Program (ordering app) | WXML/WXSS/JS, WeChat API |
| `pizza-server/` | Backend API + Admin EJS | Express.js + MySQL + JWT + Session |
| `soybean-admin-temp/` | Admin SPA (production) | Vue3 + Vite8 + NaiveUI + UnoCSS |

- **AppID**: `wx06b8f02feceac089`
- **Node version**: pnpm + Soybean Admin require Node >= v22.13. Local system PATH defaults to v18 — override before building.
- **Memory**: See `C:\Users\61778\.claude\projects\D--Code-Pizza\memory\MEMORY.md` for previously learned lessons.
- **Production**: `https://pizza.artaides.com` (Nginx → Express `/api` + static `/uploads`; Admin at `/admin/` served from Soybean Admin dist) — server `103.236.67.179`
- **Domain**: `pizza.artaides.com` — server `103.236.67.179`
- **Deploy env vars**: `deploy.py` reads `PIZZA_HOST`, `PIZZA_PASS` (and optionally `PIZZA_USER`, `PIZZA_PORT`). Set `$env:PIZZA_HOST = "103.236.67.179"` before deploying.

## Key Reference — Node.js Version

- **pnpm + Soybean Admin require Node >= v22.13**. The system PATH defaults to v18.6.0 at `D:\BtSoft\pm2\18.6.0\node.exe` — always override when building:
  ```powershell
  $env:PATH = "C:\Program Files\nodejs;" + $env:PATH
  ```
- Server runs Node.js v24 on the production host under PM2.

---

## Sub-Project 1: pizza-server (Express Backend)

### Commands

```bash
# Development (auto-restart via node --watch)
npm run dev

# Production
npm start

# DB setup
npm run migrate    # create tables
npm run seed       # insert seed data
```

### Architecture

```
src/
├── app.js                  — Express app setup, middleware, route mounts, cron jobs, graceful shutdown
├── config/
│   ├── index.js            — env-based config (port, db, jwt, wx, upload, printer, business)
│   ├── database.js         — mysql2 pool
│   └── multer.js           — shared multer instance (diskStorage, 5MB limit)
├── middleware/
│   ├── auth.js             — JWT Bearer token verifier (required + optional)
│   ├── roleGuard.js        — adminOnly middleware
│   ├── validation.js       — Joi request validation
│   ├── errorHandler.js     — global error handler
│   └── requestId.js        — X-Request-Id per request (crypto.randomBytes)
├── controllers/            — Request handlers
├── services/               — Business logic + SQL queries (33 files)
│   ├── systemConfigService.js — 5-group admin-configurable settings (pay/printer/map/business/storage)
│   ├── cosService.js       — Tencent COS object storage (upload, delete, isConfigured)
│   ├── defaultAvatarService.js — Default avatar CRUD + getRandom() for new users
│   ├── kuaidi100Service.js  — kuaidi100 logistics API (tracking query, auto-detect carrier, MD5 signing)
│   ├── logisticsService.js  — Logistics tracking orchestration for shop orders
│   ├── shopRefundService.js — Shop order refunds (balance credit-back + WeChat Pay)
│   ├── shopFavoriteService.js — Shop product favorites
│   ├── luckyWheelService.js + luckyWheel.logic.js — Lucky wheel game backend + logic
│   ├── carrierMap.js       — Carrier name-to-code mapping + tracking-number prefix detection (20+ carriers)
│   ├── orderCleanupService.js — Auto-cancel unpaid orders (cron-driven)
│   ├── auditService.js     — Fire-and-forget audit logging (NEVER throws)
│   ├── reconciliationService.js — Payment vs order cross-check
│   ├── refundService.js    — Balance + WeChat refunds with stock/coupon/points reversal
│   ├── paymentService.js   — Order + recharge payment processing
│   └── printerService.js   — Cloud receipt printing
├── routes/                 — Express Routers (mounted at /api/v1/*)
│   ├── adminApi.js         — Admin JSON API (/api/v1/admin/*), JWT + adminOnly
│   ├── logistics.js        — Logistics tracking endpoints
│   ├── luckyWheel.js       — Lucky wheel game endpoints
│   └── shop.js             — Shop (会员商城) endpoints
└── utils/
    ├── jwt.js              — JWT sign/verify
    ├── wechat.js           — WeChat login (code→openid) + getAccessToken (cached 2h) + getPhoneNumber(code)
    ├── wechatPay.js        — WeChat Pay v3 crypto (sign, verify, decrypt, payRequest)
    ├── memberTier.js       — Tier calculation from totalSpent
    ├── pickupCode.js       — 4-digit pickup code generator
    ├── orderStateMachine.js — Order state transitions + guards
    └── logger.js           — Pino structured logging (createLogger)
```

### Two Auth Systems

1. **JWT (API auth)**: Miniprogram & admin API clients. `src/utils/jwt.js` — sign/verify with `config.jwtSecret`. Middleware `auth` extracts `req.user = { id, role }`.
2. **Session (Admin EJS)**: Admin pages rendered by EJS use `express-session` with MySQL store. Logged in via `/admin/login` (EJS form POST).

### Route Conventions

- Public API routes: `/api/v1/auth` (login, logout, **phone** binding), `/api/v1/products`, `/api/v1/banners`, `/api/v1/config` (map, beian, **default-avatars**)
- User API routes: `/api/v1/user/*` — profile, settings, member-tiers, **balance** (history + recharge)
- Payment routes: `/api/v1/pay/*` — order payment, recharge, WeChat Pay notify callbacks
- Admin API routes: `/api/v1/admin/*` — all behind `auth` + `adminOnly` middleware
  - CRUD: products, orders, coupons, coupon-templates, member-tiers, users, points, banners
  - Settings: `/admin/settings/{pay,printer,map,store,business,storage}` (GET/PUT)
  - **Default avatars**: `/admin/default-avatars` (GET/POST/DELETE)
  - Ops: `/admin/audit-logs`, `/admin/reconciliation`, `/admin/payment-records`
- Admin EJS routes: `/admin` — session-based, renders EJS views
- Upload static files: `/uploads` → `config.upload.dir` (default `uploads/`)

### Database

- MySQL, database `pizza`, charset `utf8mb4`
- Pool configured in `config/database.js`
- Tables defined in `db/schema.sql` — new tables go here (not auto-migrated)
- **Migration pattern**: Incremental SQL files named `db/migrate_<feature>.sql` or `db/migrate_phase<N>_<name>.sql`. Run manually via `npm run migrate` or direct `mysql < file.sql`. No auto-migration framework — each migration uses `IF NOT EXISTS` / `ALTER TABLE ... ADD COLUMN` to be idempotent.
- **deploy.py** runs all migrations in order; duplicates produce harmless `Duplicate column` warnings.

### Cron Jobs (2 active)

| Schedule | Job | Config Source |
|----------|-----|---------------|
| `0 2 * * *` | Expire overdue coupons | Hardcoded |
| `*/5 * * * *` | Auto-cancel unpaid orders past timeout | `config.business.unpaidTimeoutMinutes` (default 30) |

Both stopped during graceful shutdown. Both only log when count > 0.

### System Config (Admin-Configurable)

`system_config` table stores key-value pairs. `systemConfigService` manages 5 groups, each with a **get/update/sync triplet**:

| Group | DB Prefix | Notable Fields |
|-------|-----------|---------------|
| **pay** | `wx_pay_*` | mchId, apiV3Key, certs, notifyUrl, refundNotifyUrl |
| **printer** | `printer_*` | enabled, sn, copies, storeName |
| **map** | `map_*` | tencentKey |
| **business** | `biz_*` | orderCancelMinutes (1), unpaidTimeoutMinutes (30), storeName ('爱家店') |
| **storage** | `cos_*` | Tencent COS config (SecretId, SecretKey, Bucket, Region) |

- Writes use `INSERT ... ON DUPLICATE KEY UPDATE` (UPSERT) — keys auto-created on first save.
- **Startup sync**: All 5 groups synced from DB to in-memory `config` in the `listen()` callback.
- **Write-time sync**: After each `updateXConfig()`, the corresponding `syncXConfigToMemory()` runs immediately.
- Priority chain: `.env` defaults → loaded into `config/index.js` → overridden by DB values at startup and on admin save.

### Order State Machine

```
waiting   → preparing (guard: must be paid)
waiting   → cancelled
preparing → completed
preparing → cancelled
completed → (terminal)
cancelled → (terminal)
```

`utils/orderStateMachine.js` exports `validateTransition(currentStatus, newStatus, order)`. Used by `orderService.adminUpdateStatus()`. User-facing cancel enforced by SQL `WHERE status IN ('waiting','preparing')`.

**Cancel time window**: User can cancel within `config.business.orderCancelMinutes` (default 1 minute). Enforced in `orderController.cancel()`. Admin cancel is unrestricted. Order API returns `canCancel` (bool) + `cancelDeadline` (ISO timestamp) for frontend display.

### Production

- Runs under PM2 (`pm2 restart pizza-server`)
- Config via `.env` at project root
- Deploy: `python soybean-admin-temp/deploy.py backend` (git pull → npm install → migrations → pm2 restart)
- **Health check**: `GET /health` → `{ status: "ok"|"degraded", uptime, db: "ok"|"unreachable" }` (200/503)
- **Rate limiting**: Global API 200/15min, auth 20/15min, pay 30/15min
- **Graceful shutdown**: SIGTERM/SIGINT → stop cron → close HTTP → close DB pool. `unhandledRejection` logs but does NOT exit.
- **Logging**: Pino structured JSON (production), pino-pretty (dev). `createLogger('Module')` per file.
- **WeChat Pay callbacks**: `/pay/notify` and `/pay/refund-notify` mount `express.raw()` BEFORE `express.json()` for signature verification.

---

## Sub-Project 2: soybean-admin-temp (Admin SPA)

Soybean Admin v2.2.0 — a Vue3 + NaiveUI admin framework. NOT a custom admin. Upstream: `soybeanjs/soybean-admin`.

### Commands

```bash
pnpm install
pnpm dev          # Vite dev server (test mode, proxies /api → localhost:3000)
pnpm build        # Vite build (prod mode) → dist/
pnpm gen-route    # Generate elegant-router types from routes/index.ts
```

### Architecture (files we added/modified)

```
src/
├── router/
│   ├── routes/index.ts          — Route definitions (CustomRoute[] array)
│   └── elegant/
│       ├── imports.ts           — View lazy-import mappings
│       └── transform.ts         — Route name → path map
├── service/api/                 — API functions using @sa/axios flat-request
│   ├── upload.ts                — fetchUploadImage, fetchFileList, fetchDeleteFile
│   ├── settings.ts              — Settings API (pay/printer/map/store/business)
│   ├── product.ts, order.ts, coupon.ts, user.ts, points.ts
│   └── index.ts                 — Barrel exports (must export new modules here)
├── views/                       — Page components
│   ├── settings/                — System settings pages
│   │   ├── pay/index.vue        — WeChat Pay config
│   │   ├── printer/index.vue    — Printer config + test + live preview
│   │   ├── map/index.vue        — Tencent Map key
│   │   ├── store/index.vue      — Store info (name, address, coords)
│   │   ├── business/index.vue   — Business config (cancel window, timeout, store name)
│   │   ├── storage/index.vue    — COS object storage config
│   │   ├── logistics/index.vue  — Logistics (kuaidi100) config
│   │   └── avatars/index.vue    — Default avatar management (grid, upload, delete, max 10)
│   ├── files/list/index.vue     — File manager (NGrid, upload, delete, preview)
│   ├── products/form/index.vue  — ImageUpload component replaces URL input
│   └── points/form/index.vue    — Same ImageUpload integration
├── components/common/
│   └── ImageUpload.vue          — Reusable upload component
├── locales/langs/
│   ├── zh-cn.ts                 — i18n keys (route section for menu labels)
│   └── en-us.ts
└── typings/elegant-router.d.ts  — Route type definitions (must match routes/index.ts)
```

### Key Patterns

- **API calls**: `request<T>()` from `@sa/axios` returns `{ data, error }` via flat-request. See `src/service/api/upload.ts` for examples of both JSON (`request<>()`) and multipart (raw `fetch()`) patterns.
- **Multipart upload**: Raw `fetch()` because Soybean's flat-request is JSON-only.
- **Routes**: Uses `@elegant-router/vue` with `CustomRoute[]` and `layout.base$view.xxx` component syntax. After editing routes, run `pnpm gen-route` to regenerate types.
### elegant-router Route Naming (CRITICAL)

elegant-router auto-generates **ALL LOWERCASE** route names from `src/views/` directory structure. When adding custom routes in `routes/index.ts`, the `name` field must match the auto-generated lowercase name **exactly**, or the override won't work and you'll get duplicate menus:

```ts
// ❌ WRONG — creates duplicate menu entry
{ name: 'couponTemplates', ... }
{ name: 'memberTiers', ... }

// ✅ CORRECT — overrides auto-generated route
{ name: 'coupontemplates', ... }
{ name: 'membertiers', ... }
```

Merge logic (`routes/index.ts`): `[...generatedRoutes, ...customRoutes]` — later overrides earlier **only** on exact case-sensitive name match.

**Sub-menu nesting**: directory structure must mirror route hierarchy. E.g., to nest coupon templates under coupons: move `src/views/couponTemplates/` → `src/views/coupons/templates/`. The Vite plugin auto-regenerates type files on `pnpm build`.

- **Adding a new page checklist**:
  1. Create view file under `src/views/<name>/list/index.vue`
  2. Add route in `src/router/routes/index.ts`
  3. Add view import in `src/router/elegant/imports.ts`
  4. Add route name→path in `src/router/elegant/transform.ts`
  5. Add types in `src/typings/elegant-router.d.ts` (FirstLevelRouteKey, LastLevelRouteKey, RouteMap)
  6. Add i18n labels in `src/locales/langs/zh-cn.ts` and `en-us.ts` under `route`
  7. Add API module in `src/service/api/` and export from `index.ts`

### Deploy

```bash
# Build & deploy admin to production server
$env:PATH = "C:\Program Files\nodejs;" + $env:PATH
cd soybean-admin-temp && pnpm build
cd .. && python soybean-admin-temp/deploy.py frontend
```

`deploy.py` uses paramiko (SSH) to upload `dist/` to `/www/wwwroot/pizza.artaides.com/admin/` and clean old files.

---

## Sub-Project 3: miniprogram (WeChat Mini Program)

### Build/Preview

Open `miniprogram/` in WeChat Developer Tools. Enable ES6→ES5, PostCSS, minification in project config. No CLI build.

### Architecture: Two Navigation Patterns

#### 1. Main page with inline tabs (`pages/main/`)
The primary entry. Uses a `<swiper>` with 4 panes (点单/订单/会员/我的), each rendered via `<include src="tpl-*.wxml"/>`. Tab bar is hand-built in `main.wxml` (not native tabBar). All swiper pane logic in `main.js`. Sub-pages (points, coupons, address, store) pushed via `wx.navigateTo`.

#### 2. Standalone tab pages (`pages/index/`, `pages/orders/`, `pages/member/`, `pages/profile/`)
Each is a full Page with its own `Page()` constructor, but **they are NOT registered in `app.json`** — they exist as legacy/duplicate code or are consumed as inline templates by `main.wxml`. They share a `custom-tab-bar` Component. Profile navigates to points/coupons/address/store via `wx.navigateTo`.

**Sync rule**: When adding a new page, wire it in:
- `app.json` → `pages` array (required for `wx.navigateTo`)
- `main.js` → `routes` object in `onMenuItem`
- `profile.js` → `actions` object in `onMenuItem`
- Create `<page>.json` with `"navigationStyle": "custom"` and page title — see Common Pitfalls
- For backend-backed features: add routes in `pizza-server/src/routes/`, controller logic, and any new DB tables to `db/schema.sql`

### API Layer

`utils/api.js` provides `{ doLogin, api }`. `api` is a wrapper around `wx.request` that:
- Prepends base URL (from config) to paths
- Attaches `Authorization: Bearer <token>` header from storage
- Returns parsed JSON response

Cart operations sync to server in the background (`api.post('/cart/items', ...)` etc.) after local optimistic updates.

### Swiper & Scroll-View Height (CRITICAL)

WeChat's `<swiper>` does NOT support CSS flexbox. `flex: 1` and `height: 100%` don't work inside swiper children. You MUST calculate explicit pixel heights:

```js
// In onLoad:
const sys = wx.getSystemInfoSync();
const sh = sys.statusBarHeight;
const rpx = sys.windowWidth / 750;
const tabBarPx = 100 * rpx;                           // tab bar is 100rpx tall
const swiperHeight = sys.windowHeight - (sh + 36);    // 36 = top bar content height
const scrollViewHeight = swiperHeight - tabBarPx;
this.setData({ statusBarHeight: sh, topBarTotalHeight: sh + 36, scrollViewHeight });
```

In WXML:
```html
<swiper style="height: {{scrollViewHeight}}px;">
  <swiper-item>
    <scroll-view scroll-y enhanced show-scrollbar="{{false}}" style="height: {{scrollViewHeight}}px;">
      <!-- content -->
      <view style="height: calc(120rpx + env(safe-area-inset-bottom))"></view>
    </scroll-view>
  </swiper-item>
</swiper>
```

Key rules:
- Every `<scroll-view>` inside a `<swiper-item>` MUST have `enhanced` attribute (prevents touch gesture conflicts)
- Every `<scroll-view>` inside a swiper MUST have explicit pixel `height` set via `{{scrollViewHeight}}`
- Always add a bottom spacer `<view style="height: calc(120rpx + env(safe-area-inset-bottom))">` as the last child
- **NEVER use `sys.safeAreaInsets`** — it doesn't exist. The correct path is `sys.safeArea.bottom`. Prefer CSS `env(safe-area-inset-bottom)` instead of JS calculation.

### Custom Top Bar

All pages use `"navigationStyle": "custom"`. Each page calculates and renders its own top bar:

- **Simple title bar** (points, store, member): `topBarTotalHeight = statusBarHeight + 36`
- **With back button** (coupons, address, tiers): use dynamic rpx formula:
  ```js
  const rpx = sys.windowWidth / 750;
  const topBarH = sh + 80 * rpx + 24 * rpx; // statusBar + back-btn(80rpx) + padding(24rpx)
  ```
- **tiers page** uses a fixed top bar with back button + centered title, no rpx calculation needed since it doesn't contain a swiper.

### Custom Tab Bar (NOT native)

The app does NOT use WeChat's native `tabBar` config. Instead, `main.wxml` has a hand-built `<view class="tab-bar">` with 4 items (点单/订单/会员/我的) that switches `currentTab` to drive a `<swiper>`. The standalone tab pages (`index/`, `orders/`, `member/`, `profile/`) each use a `custom-tab-bar` Component that calls `wx.switchTab`-like behavior.

### Membership Tier System

Tier logic is centralized in `utils/tiers.js` (single source of truth). Three pages consume it:

| Page | Function Used | Card Type |
|------|--------------|-----------|
| `pages/profile/` | `buildTierCards()` | Swiper cards (swipeable) |
| `pages/main/` (tpl-profile) | `buildTierCards()` | Swiper cards (swipeable) |
| `pages/tiers/` | `buildBenefitTiers()` | Hero card + comparison cards |

**Key exports from `utils/tiers.js`**:
- `FALLBACK_TIERS` — 5 tiers (silver → diamond) with `levelKey, name, levelIndex, minSpent, discountRate, pointsRewardRate, bgImage, accentColor`
- `computeTier(totalSpent, tiers, memberLevel)` — determines current/next tier. Prioritizes server-set `memberLevel` (admin override), falls back to `totalSpent` calculation.
- `buildTierCards(apiTiers, userTier)` — for profile/main swiper (adds `isActive`, `progressText`, `progressPercent`)
- `buildBenefitTiers(apiTiers, userTier, totalSpent)` — for tiers page (adds `benefitItems[]`, `rangeText`)
- `loadTiers()` — module-level cached API fetch with FALLBACK_TIERS merge. Replaces per-page `_ensureTiersLoaded()`.
- `clearTierCache()` — invalidates cache (call after tier admin changes)

**Backend-configurable**: Tier data flows from API (`/user/member-tiers`) → `FALLBACK_TIERS` as fallback. `loadTiers()` merges `{ ...fallback, ...apiTier }` so local `bgImage` survives when API doesn't provide it.

### WXSS Known Quirks

- **`background` shorthand with `/` is NOT supported**: `background: url(...) center/cover no-repeat` — the `/` for `background-size` inside the `background` shorthand is silently dropped by WeChat's WXSS parser. Always use longhand properties:
  ```css
  /* WRONG — silently ignored */
  .card { background: url('/img.jpg') center/cover no-repeat; }

  /* CORRECT */
  .card {
    background-image: url('/img.jpg');
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
  }
  ```
- **`background-image: url(local-path)` is unreliable**: Even with longhand properties, local image paths in CSS `url()` have limited support in WeChat WXSS. For reliable image backgrounds, use an `<image>` tag positioned absolutely behind the content layer:
  ```html
  <view class="card">
    <image class="card-bg-img" src="/images/bg.jpg" mode="aspectFill"></image>
    <view class="card-content"><!-- z-index: 1, position: relative --></view>
  </view>
  ```
  ```css
  .card { position: relative; overflow: hidden; }
  .card-bg-img { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 0; }
  ```
  Note: `<image>` backgrounds may not render in WeChat DevTools but work correctly in Preview and on real devices.

- **rpx is the primary CSS unit** (750rpx = screen width). Avoid px in WXSS unless for precise values like `1rpx` borders.

### Image Constraints

- **2MB source size limit**: WeChat mini program total source package must be under 2MB (error 80051). This includes all images, JS, WXML, and WXSS files.
- **Image format tradeoffs**:
  - PNG: lossless, good for icons/simple graphics, larger files
  - JPEG: lossy, good for photographic backgrounds, much smaller (quality 80 is a good balance)
- **Image dimensions**: Card background images at 1260×680px (2x retina) strike a good balance between quality and file size. Full-resolution PNGs at 1890×1020 can easily push the package over 2MB.

### Clay Style Design System (黏土风) — 会员商城专属

会员商城（shop / shop-detail / shop-orders / shop-order-detail + main 页商城 tab）统一使用**黏土风**，
替代毛玻璃效果。Token 定义在 `app.wxss` 的 `page{}` 中（`--clay-*` 变量族），与全局 `--glass-*` 并存。

**核心原则**：
- **不透明暖色底** — 无 `backdrop-filter`，无透明度。底色为暖白/暖米渐变，模拟黏土质感。
- **暖棕投影** — 所有 `box-shadow` 使用 `rgba(120, 108, 94, ...)` 暖棕色，不用冷黑。
- **顶缘内高光** — `inset 0 1~2rpx rgba(255,255,255,0.7~0.9)` 模拟顶光打在凸面上的高光线。
- **凸面渐变** — 按钮/卡片用 `linear-gradient(180deg, 上亮 → 下暗)` 产生立体凸起感。

**Clay Token 表**：

| 类别 | Token | 值 | 用途 |
|------|-------|----|------|
| 背景-导航栏 | `--clay-bg-nav` | `#FEFCF8` | 顶栏/底栏固定背景 |
| 背景-卡片 | `--clay-bg-card` | `#FDFBF7` | 卡片/列表项底色 |
| 背景-浮层 | `--clay-bg-elevated` | `#F8F3EA` | 抽屉/弹层/高亮区 |
| 背景-浅色 | `--clay-bg-light` | `#F5EFE5` | 禁用态/次级底色 |
| 背景-主按钮 | `--clay-bg-primary` | `linear-gradient(180deg, #D4846B, #C0563A)` | 主操作按钮渐变 |
| 背景-主色浅 | `--clay-bg-primary-light` | `#FDF0EB` | 收藏激活/选中态浅底 |
| 边框-通用 | `--clay-border` | `2rpx solid rgba(180,160,140,0.28)` | 卡片/按钮通用边框 |
| 边框-淡 | `--clay-border-subtle` | `2rpx solid rgba(180,160,140,0.18)` | 分隔线/次要边框 |
| 边框-主色 | `--clay-border-colored` | `2rpx solid rgba(192,86,58,0.30)` | 主色强调边框 |
| 阴影-卡片 | `--clay-shadow-card` | `inset 0 1rpx 1rpx rgba(255,255,255,0.9), 0 4rpx 12rpx rgba(120,108,94,0.12), 0 2rpx 4rpx rgba(120,108,94,0.06)` | 卡片浮起 |
| 阴影-抬高 | `--clay-shadow-elevated` | `inset 0 1rpx 1rpx rgba(255,255,255,0.85), 0 8rpx 24rpx rgba(120,108,94,0.16), 0 2rpx 6rpx rgba(120,108,94,0.08)` | Hero/Featured 卡 |
| 阴影-按钮 | `--clay-shadow-button` | `inset 0 1rpx 1rpx rgba(255,255,255,0.7), 0 4rpx 12rpx rgba(192,86,58,0.25), 0 1rpx 3rpx rgba(120,108,94,0.12)` | 主按钮投影 |
| 阴影-导航 | `--clay-shadow-nav` | `inset 0 1rpx 0 rgba(255,255,255,0.8), 0 2rpx 16rpx rgba(120,108,94,0.10)` | 固定顶栏/底栏 |

**FAB 悬浮按钮**（订单入口）直接使用内联 clay 值，不走 token：
```css
background: linear-gradient(180deg, #FEFCF8 0%, #F0E9DC 100%);
box-shadow: inset 0 2rpx 4rpx rgba(255,255,255,0.85), 0 6rpx 18rpx rgba(120,108,94,0.18), 0 2rpx 4rpx rgba(120,108,94,0.08);
```

**Clay 页面清单**：
| 页面 | WXSS | 备注 |
|------|------|------|
| 商城主页 | `pages/shop/shop.wxss` | 商品列表 + 分类 + Banner |
| 商城( main tab ) | `pages/main/main.wxss` §商城 | 与 shop.wxss 同步，样式在 main.wxss 557-627 行 |
| 商品详情 | `pages/shop-detail/shop-detail.wxss` | 图片轮播 + 结账抽屉，覆盖全局 `.card` |
| 订单列表 | `pages/shop-orders/shop-orders.wxss` | 状态 tabs + 订单卡片 |
| 订单详情 | `pages/shop-order-detail/shop-order-detail.wxss` | 状态头 + 商品行 + 退款信息，覆盖全局 `.card` |

**⚠ 全局 `.card` 覆盖规则**：`app.wxss` 的 `.card` 使用 `--glass-*` token。
`shop-detail` 和 `shop-order-detail` 在对应页面级 class（`.sd-info` / `.sd-desc` / `.sod-section`）中显式设置
`background: var(--clay-bg-card)` + `box-shadow: var(--clay-shadow-card)` + `border: var(--clay-border-subtle)`，
利用页面 WXSS 后加载规则覆盖全局 `.card`，不需要修改 `app.wxss`。

**⚠ 与其他页面的关系**：`--glass-*` token 族**保留不动**，供首页/订单/会员/个人中心等其他页面继续使用。
黏土风仅限会员商城模块。两个 token 族在 `app.wxss` 中并列共存，互不冲突。

### Data Layer

`utils/data.js` exports mock data (still used as fallback when API unavailable): `products`, `categories`, `orders`, `pointsProducts`, `dietaryRestrictions`, `coupons`, `addresses`.

Cart state in `app.globalData` (in-memory, lost on restart):
- `app.globalData.cart` — `{ [productId]: { ...product, quantity, restrictions[] } }`
- Methods: `app.addToCart()`, `app.decreaseQuantity()`, `app.removeFromCart()`, `app.clearCart()`
- `app.updateCartData()` broadcasts to all active pages via `page.updateCart()` if defined

### Page Patterns

#### Drawer/overlay (points, coupons, address form)
```wxml
<view class="form-overlay {{mode === 'form' ? 'show' : ''}}" catchtap="onFormBack">
  <view class="form-drawer {{mode === 'form' ? 'show' : ''}}" catchtap="noop">
    <!-- drawer content -->
  </view>
</view>
```
Uses `visibility: hidden` + `transform: translateY(100%)` for slide-up. Always add `catchtap="noop"` on the inner drawer.

#### `catchtap` vs `bindtap`
- `catchtap` stops event propagation (inner elements inside tappable cards)
- `bindtap` allows bubbling (card-level taps)

### File Structure

```
miniprogram/
├── app.js              — App lifecycle, globalData, cart methods, auto-login
├── app.json            — Page registration (14 pages), window config
├── app.wxss            — Design tokens, utility classes, global reset
├── utils/
│   ├── api.js          — HTTP client (wx.request wrapper), doLogin()
│   ├── data.js         — Mock/fallback data
│   ├── tiers.js        — Shared tier module: FALLBACK_TIERS, computeTier, buildTierCards, buildBenefitTiers, loadTiers
│   ├── orders.js       — ORDER_STATUS_MAP, formatOrder (adds canCancel, isPaid, statusText, etc.)
│   ├── layout.js       — Shared top bar height calculations (getSimpleTopBar, getBackBtnTopBar, getSwiperLayout)
│   ├── pay.js          — WeChat Pay flow: payOrder, rechargeBalance (with retry polling)
│   ├── shopPay.js      — 商城订单支付: payShopOrder (WeChat Pay + 余额)
│   ├── mapConfig.js    — Tencent Maps API wrapper (walking distance, reverse geocode)
│   ├── auth.js         — Shared logout logic with confirmation modal
│   └── profileShared.js — Profile mixin: profileMethods (avatar/edit/tier/announce/birthday) + loadProfileCore(page, hooks) + computeBirthdayInfo()
├── components/         — Reusable UI components
│   ├── quick-login/    — WeChat phone quick login (phone auth → auto-assign default avatar → done)
│   ├── cart-bar/       — Cart bottom bar
│   ├── product-card/   — Product display card
│   └── tab-bar/        — Custom tab bar
├── custom-tab-bar/     — Legacy tab bar Component (for standalone pages)
├── pages/
│   ├── main/           — Swiper 4-tab entry (main.js + main.wxml + tpl-index/orders/shop/profile.wxml)
│   ├── index/          — ⚠ Standalone 点单 (NOT in app.json; duplicate of main tab 0 logic)
│   ├── orders/         — ⚠ Standalone 订单 (NOT in app.json)
│   ├── member/         — ⚠ Standalone 会员 (NOT in app.json; content duplicated inline in main.wxml as modal)
│   ├── profile/        — ⚠ Standalone 我的 (NOT in app.json)
│   ├── points/         — 积分商城
│   ├── coupons/        — 兑换券/优惠券
│   ├── address/        — 收货地址 (list/form CRUD, validation)
│   ├── store/          — 门店信息
│   ├── shop/           — 会员商城独立页（黏土风 🌸）
│   ├── shop-detail/    — 商品详情 + 结账抽屉（黏土风 🌸）
│   ├── shop-orders/    — 商城订单列表（黏土风 🌸）
│   ├── shop-order-detail/ — 商城订单详情 + 退款（黏土风 🌸）
│   ├── shop-logistics/ — 物流跟踪（黏土风 🌸, expandable cards）
│   ├── favorites/      — 商城收藏（黏土风 🌸）
│   ├── claim-center/   — 优惠券领取中心
│   ├── lucky-wheel/    — 幸运转盘抽奖
│   ├── settings/       — 设置页
│   ├── tiers/          — 会员权益页 (hero card + horizontal compare + 2-col benefits grid + rules)
│   └── recharge/       — 余额充值 (preset amounts + custom input + confirm modal)
└── images/             — Icons (PNG) + card background images (JPEG, ~30KB each)
```

⚠ Pages marked "NOT in app.json" exist on disk but are not registered as routes. They are either consumed as inline templates by `main.wxml` (`<include src="tpl-*.wxml"/>`) or are legacy/orphaned code. The `member/` page's UI is duplicated as a modal overlay inside `main.wxml`.

### Quick Login Component

`components/quick-login/` — Single-step WeChat phone auth. User clicks "微信一键登录", authorizes phone number via `getPhoneNumber`, and is logged in directly (no profile-completion step). On success, the server (`POST /api/v1/auth/phone`) binds the phone and randomly assigns a default avatar if the user has none.

### Common Pitfalls

- **CSS `background` shorthand with `/`**: WeChat WXSS silently drops `background: url(...) center/cover`. Use longhand `background-image`, `background-size`, `background-position`, `background-repeat` instead.
- **`background-image: url()` unreliable**: Local image paths in CSS `url()` have limited WeChat WXSS support. Use `<image>` tag with `src` as an absolutely-positioned background layer for reliable results.
- **Hybrid background approach**: For tier cards, use BOTH inline `style="{{item.bgStyle}}"` (works in DevTools) AND `<image>` tag (works on real devices). Neither alone covers both platforms.
- **Tier progress negative values**: When admin manually sets a lower tier while `totalSpent` is high, `nextTier.minSpent - totalSpent` goes negative. `buildTierCards()` and `buildBenefitTiers()` in `utils/tiers.js` clamp this — when `diff ≤ 0`, show "已满足升级条件" and set `progressPercent = 100`. Always check for negative before displaying "还差¥X" text.
- **`loadTiers()` merge pattern**: `utils/tiers.js` `loadTiers()` merges API data with FALLBACK_TIERS: `{ ...fallback, ...apiTier }` — so local `bgImage` survives when API doesn't provide it. Do NOT replace fallback data wholesale.
- **New page `.json` required**: Every new page must have a `<page>.json` file with `"navigationStyle": "custom"` and `"navigationBarTitleText": "页面名称"`. Without it, the system nav bar shows "王姐手工披萨" on top of the custom top bar.
- **2MB source size limit**: Keep images compressed. Use JPEG quality 80 for photos, PNG only for small icons. Total `images/` directory should stay well under 500KB.
- **`form.region.length` in WXML**: Use ternary `{{form.region.length ? form.region[0] : 'placeholder'}}`. Accessing `[0]` on empty array silently renders nothing.
- **Form validation**: Return error string or `null`; show via `wx.showToast({ title: error, icon: 'none' })`.
- **Default address**: When setting default, iterate all others to `false`. When deleting default, promote first remaining.
- **Duplicate page logic**: `main.js` and `pages/index/index.js` share near-identical product/cart code. Changes must mirror in both. `main.js` version also handles dietary restrictions (index.js does not).
- **Tab bar state sync**: Standalone pages update `custom-tab-bar`'s `selected` in `onShow`. Main page manages tab state internally via `currentTab`.
- **`wx:if` vs `hidden`**: `wx:if` for infrequent toggles (modes, overlays). `hidden` for frequent toggles.
- **`env(safe-area-inset-bottom)`**: Always add to fixed bottom bars, FABs, and scroll-view spacers.

---

## gstack 角色路由

- 当需要产品决策、范围判断时，使用 `/office-hours` 或 `/plan-ceo-review`
- 当需要架构审查时，使用 `/plan-eng-review`
- 当代码准备合并前，使用 `/review` 进行代码审查
- 当需要端到端测试时，使用 `/qa`
- 当准备发布时，使用 `/ship`
