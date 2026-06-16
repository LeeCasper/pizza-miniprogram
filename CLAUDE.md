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
- **Production**: `https://www.artaides.com` (Nginx → Express `/api` + static `/uploads`; Admin at `/admin/` served from Soybean Admin dist)

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
├── app.js                  — Express app setup, middleware, route mounts
├── config/
│   ├── index.js            — env-based config (port, db, jwt, wx, upload)
│   ├── database.js         — mysql2 pool
│   └── multer.js           — shared multer instance (diskStorage, 5MB limit)
├── middleware/
│   ├── auth.js             — JWT Bearer token verifier (required + optional)
│   ├── roleGuard.js        — adminOnly middleware
│   ├── validation.js       — Joi request validation
│   └── errorHandler.js     — global error handler
├── controllers/            — Request handlers
├── services/               — Business logic + SQL queries
├── routes/                 — Express Routers (mounted at /api/v1/*)
│   └── adminApi.js         — Admin JSON API (/api/v1/admin/*), JWT + adminOnly
└── utils/                  — jwt, wechat login, memberTier, pickupCode
```

### Two Auth Systems

1. **JWT (API auth)**: Miniprogram & admin API clients. `src/utils/jwt.js` — sign/verify with `config.jwtSecret`. Middleware `auth` extracts `req.user = { id, role }`.
2. **Session (Admin EJS)**: Admin pages rendered by EJS use `express-session` with MySQL store. Logged in via `/admin/login` (EJS form POST).

### Route Conventions

- Public API routes: `/api/v1/auth`, `/api/v1/products`, etc.
- Admin API routes: `/api/v1/admin/*` — all behind `auth` + `adminOnly` middleware
- Admin EJS routes: `/admin` — session-based, renders EJS views
- Upload static files: `/uploads` → `config.upload.dir` (default `uploads/`)

### Database

- MySQL, database `pizza`, charset `utf8mb4`
- Pool configured in `config/database.js`
- Cron job at 2am daily expires overdue coupons via `node-cron`

### Production

- Runs under PM2 (`pm2 restart pizza-server`)
- Config via `.env` at project root
- Deploy script: `deploy.sh` (git pull → npm install → pm2 restart)

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
│   ├── routes/index.ts          — Route definitions (we added `files` route)
│   └── elegant/
│       ├── imports.ts           — View lazy-import mappings
│       └── transform.ts         — Route name → path map
├── service/api/                 — API functions using @sa/axios flat-request
│   ├── upload.ts                — (NEW) fetchUploadImage, fetchFileList, fetchDeleteFile
│   ├── product.ts, order.ts, coupon.ts, user.ts, points.ts
│   └── index.ts                 — Barrel exports (must export new modules here)
├── views/                       — Page components
│   ├── files/list/index.vue     — (NEW) File manager (NGrid, upload, delete, preview)
│   ├── products/form/index.vue  — (MOD) ImageUpload component replaces URL input
│   └── points/form/index.vue    — (MOD) Same ImageUpload integration
├── components/common/
│   └── ImageUpload.vue          — (NEW) Reusable upload component
├── locales/langs/
│   ├── zh-cn.ts                 — i18n keys (route section for menu labels)
│   └── en-us.ts
└── typings/elegant-router.d.ts  — Route type definitions (must match routes/index.ts)
```

### Key Patterns

- **API calls**: `request<T>()` from `@sa/axios` returns `{ data, error }` via flat-request. See `src/service/api/upload.ts` for examples of both JSON (`request<>()`) and multipart (raw `fetch()`) patterns.
- **Multipart upload**: Raw `fetch()` because Soybean's flat-request is JSON-only.
- **Routes**: Uses `@elegant-router/vue` with `CustomRoute[]` and `layout.base$view.xxx` component syntax. After editing routes, run `pnpm gen-route` to regenerate types.
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

`deploy.py` uses paramiko (SSH) to upload `dist/` to `/opt/pizza-admin/` and clean old files.

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
- `main.js` → `routes` object in `onMenuItem`
- `profile.js` → `actions` object
- `app.json` → `pages` array

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

Three pages render membership tier cards, each with their own copy of tier logic (known duplication — see "Common Pitfalls"):

| Page | Builder Function | Card Type | Background Class |
|------|-----------------|-----------|-----------------|
| `pages/profile/` | `buildTierCards()` | Swiper cards (swipeable) | `tier-bg-{{levelIndex}}` |
| `pages/main/` (tpl-profile) | `buildTierCards()` | Swiper cards (swipeable) | `tier-bg-{{levelIndex}}` |
| `pages/tiers/` | `buildBenefitTiers()` | Hero card + comparison cards | Hero: `tier-bg-*`, Compare: `compare-bg-*` |

**`FALLBACK_TIERS`** — defined identically in `profile.js`, `main.js`, and `tiers.js`. Each tier object has:
```js
{ levelKey, name, levelIndex, minSpent, discountRate, pointsRewardRate,
  birthdayGift, couponValue, accentColor, bgStartColor, bgEndColor, bgImage }
```
- `levelIndex`: 1-5 (silver → diamond)
- `bgImage`: path to card background image, or `null` for CSS gradient fallback
- `accentColor`: used for progress bar fill, title text color (hero card), and dot indicators

**`computeTier(totalSpent, tiers)`** — determines current tier and next tier from spend amount. Identical in profile.js and main.js.

**`tiers.js` vs profile.js/main.js**: `tiers.js` uses `buildBenefitTiers()` which adds `benefitItems[]` (for 2-column grid), `rangeText`, and `compareBgClass`. `profile.js`/`main.js` use `buildTierCards()` which adds `isActive`, `progressText`, `discountText`, `actionText`.

**Backend-configurable**: Tier data is designed to flow from API (`/user/member-tiers`) → `FALLBACK_TIERS` as fallback. Background images, tier configs, and benefit text should all come from the server when API is available.

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

### Glassmorphism Design System

Defined in `app.wxss` as CSS custom properties on `page`. Key tokens:

| Category | Variables |
|----------|-----------|
| Colors | `--color-primary: #D32F2F`, `--color-secondary`, `--color-tertiary`, `--color-on-surface` |
| Glass BG | `--glass-bg-card: rgba(255,255,255,0.78)`, `--glass-bg-elevated`, `--glass-bg-nav`, `--glass-bg-primary` |
| Glass blur | `--glass-blur: saturate(180%) blur(20px)`, `--glass-blur-sm`, `--glass-blur-lg` |
| Glass border | `--glass-border`, `--glass-border-subtle`, `--glass-border-colored` |
| Radius | `--radius-card: 24rpx`, `--radius-full: 9999rpx`, `--radius-sm: 16rpx` |
| Font | `--font-weight-bold: 700`, `--font-weight-semibold: 600` |
| Shadows | `--glass-shadow-card`, `--glass-shadow-button`, `--glass-shadow-elevated` |

Utility classes: `.card`, `.card-cream`, `.btn-primary`, `.btn-outline`, `.section-title`, `.page-container`

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
├── app.json            — Page registration (8 pages), window config
├── app.wxss            — Design tokens, utility classes, global reset
├── utils/
│   ├── api.js          — HTTP client (wx.request wrapper), doLogin()
│   └── data.js         — Mock/fallback data
├── custom-tab-bar/     — Tab bar Component (for standalone pages; only reusable component)
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
│   ├── shop/           — 会员商城独立页
│   ├── settings/       — 设置页
│   └── tiers/          — 会员权益页 (hero card + horizontal compare + 2-col benefits grid + rules)
└── images/             — Icons (PNG) + card background images (JPEG, ~30KB each)
```

⚠ Pages marked "NOT in app.json" exist on disk but are not registered as routes. They are either consumed as inline templates by `main.wxml` (`<include src="tpl-*.wxml"/>`) or are legacy/orphaned code. The `member/` page's UI is duplicated as a modal overlay inside `main.wxml`.

**No `components/` directory exists.** All UI is built directly inside page files. The only reusable component is `custom-tab-bar/`.

### Common Pitfalls

- **CSS `background` shorthand with `/`**: WeChat WXSS silently drops `background: url(...) center/cover`. Use longhand `background-image`, `background-size`, `background-position`, `background-repeat` instead.
- **`background-image: url()` unreliable**: Local image paths in CSS `url()` have limited WeChat WXSS support. Use `<image>` tag with `src` as an absolutely-positioned background layer for reliable results.
- **Duplicate tier logic ×3**: `FALLBACK_TIERS` and `computeTier()` are copy-pasted across `profile.js`, `main.js`, and `tiers.js`. Changes to tier data must be mirrored in all three. Consider extracting to `utils/tiers.js`.
- **2MB source size limit**: Keep images compressed. Use JPEG quality 80 for photos, PNG only for small icons. Total `images/` directory should stay well under 500KB.
- **`form.region.length` in WXML**: Use ternary `{{form.region.length ? form.region[0] : 'placeholder'}}`. Accessing `[0]` on empty array silently renders nothing.
- **Form validation**: Return error string or `null`; show via `wx.showToast({ title: error, icon: 'none' })`.
- **Default address**: When setting default, iterate all others to `false`. When deleting default, promote first remaining.
- **Duplicate page logic**: `main.js` and `pages/index/index.js` share near-identical product/cart code. Changes must mirror in both. `main.js` version also handles dietary restrictions (index.js does not).
- **Tab bar state sync**: Standalone pages update `custom-tab-bar`'s `selected` in `onShow`. Main page manages tab state internally via `currentTab`.
- **`wx:if` vs `hidden`**: `wx:if` for infrequent toggles (modes, overlays). `hidden` for frequent toggles.
- **`env(safe-area-inset-bottom)`**: Always add to fixed bottom bars, FABs, and scroll-view spacers.
