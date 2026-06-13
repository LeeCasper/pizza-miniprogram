# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WeChat Mini Program (微信小程序) for "王姐手工披萨" — a pizza ordering app with membership, points, coupons, and address management. Purely client-side with mock data; no backend.

- **AppID**: `wx553c8f1d7d51e97c`
- **Build/Preview**: Open `miniprogram/` in WeChat Developer Tools — no CLI build step. Enable ES6→ES5, PostCSS, minification in project config.
- **No tests exist** — this is a WeChat Mini Program with no test framework configured.

## Architecture: Two Navigation Patterns

The app uses **two different navigation architectures** side by side:

### 1. Main page with inline tabs (`pages/main/`)
The primary entry. Uses a `<swiper>` with 4 panes (点单/订单/会员/我的), each rendered via `<include src="tpl-*.wxml"/>`. The tab bar is hand-built in `main.wxml` (not WeChat's native tabBar). All swiper pane logic lives in `main.js` (~305 lines). Sub-pages (points, coupons, address, store) are pushed via `wx.navigateTo`.

### 2. Standalone tab pages (`pages/index/`, `pages/orders/`, `pages/member/`, `pages/profile/`)
Each is a full Page registered in `app.json`. They share a `custom-tab-bar` Component that calls `wx.switchTab`. Profile navigates to points/coupons/address/store via `wx.navigateTo`.

**Important**: Both navigation paths must be kept in sync. When adding a new page:
- Wire it in `main.js` → `routes` object in `onMenuItem`
- Wire it in `profile.js` → `actions` object
- Register it in `app.json` → `pages` array

## Custom Top Bar (Every Page)

All pages use `"navigationStyle": "custom"` — no native WeChat nav bar. Each page manually:
1. Gets `statusBarHeight` from `app.globalData` (set in `onLaunch` via `wx.getSystemInfoSync()`)
2. Calculates `topBarTotalHeight` = `statusBarHeight + contentHeight` (see below)
3. Renders a fixed `.top-bar` with inline `padding-top: {{statusBarHeight}}px`
4. Scrollable content uses `height: calc(100vh - {{topBarTotalHeight}}px)` or an explicit pixel value

### `topBarTotalHeight` calculation (NEW convention)
For pages with a back button in the top bar (coupons, address):
```js
const sys = wx.getSystemInfoSync();
const rpx = sys.windowWidth / 750;
const topBarH = sh + 80 * rpx + 24 * rpx; // statusBar + back-btn(80rpx) + padding-bottom(24rpx)
```

For pages with a simple title bar (points, store, orders, member): `sh + 36` (legacy hardcoded constant).

**Use the dynamic rpx-to-px formula for new pages** to ensure correct height across devices.

## Glassmorphism Design System

Defined in `app.wxss` as CSS custom properties on `page`. Key tokens:

| Category | Variables |
|----------|-----------|
| Colors | `--color-primary: #D32F2F`, `--color-secondary`, `--color-tertiary`, `--color-on-surface`, `--color-on-surface-variant` |
| Glass BG | `--glass-bg-card: rgba(255,255,255,0.78)`, `--glass-bg-elevated`, `--glass-bg-nav`, `--glass-bg-primary`, `--glass-bg-overlay` |
| Glass blur | `--glass-blur: saturate(180%) blur(20px)`, `--glass-blur-sm`, `--glass-blur-lg` |
| Glass border | `--glass-border`, `--glass-border-subtle`, `--glass-border-colored` |
| Radius | `--radius-card: 24rpx`, `--radius-full: 9999rpx`, `--radius-sm: 16rpx` |
| Font | `--font-weight-bold: 700`, `--font-weight-semibold: 600` |
| Shadows | `--glass-shadow-card`, `--glass-shadow-button`, `--glass-shadow-elevated` |

Utility classes: `.card`, `.card-cream`, `.btn-primary`, `.btn-outline`, `.section-title`, `.page-container`

**rpx is the primary CSS unit** (responsive pixels — 750rpx = screen width on any device). Avoid px in WXSS unless for precise pixel values (e.g., `1rpx` borders).

## Data Layer

`utils/data.js` exports all mock data: `products`, `categories`, `orders`, `pointsProducts`, `dietaryRestrictions`, `coupons`, `addresses`. Import with `require('../../utils/data')`.

Cart state lives in `app.globalData` (in-memory only, lost on restart):
- `app.globalData.cart` — `{ [productId]: { ...product, quantity, restrictions[] } }`
- `app.globalData.cartCount` / `cartTotal` — derived aggregates
- Methods: `app.addToCart()`, `app.decreaseQuantity()`, `app.removeFromCart()`, `app.clearCart()`
- `app.updateCartData()` broadcasts to all active pages via `page.updateCart()` if the method exists

## Page Patterns

### Drawer/overlay pattern (points, coupons, address form)
```wxml
<view class="form-overlay {{mode === 'form' ? 'show' : ''}}" catchtap="onFormBack">
  <view class="form-drawer {{mode === 'form' ? 'show' : ''}}" catchtap="noop">
    <!-- drawer content -->
  </view>
</view>
```
Uses `visibility: hidden` + CSS `transform: translateY(100%)` for slide-up animation. Always include `catchtap="noop"` on the inner drawer to stop event propagation. `noop()` is an empty function on the Page.

### `catchtap` vs `bindtap`
- `catchtap` stops event propagation (used for inner elements within tappable cards)
- `bindtap` allows bubbling (used for the card itself)

## File Structure

```
miniprogram/
├── app.js              — App lifecycle, globalData, cart methods
├── app.json            — Page registration, window config
├── app.wxss            — Design tokens, utility classes, global reset
├── utils/data.js       — All mock data
├── custom-tab-bar/     — Reusable tab bar Component (used by standalone pages)
├── pages/
│   ├── main/           — Swiper-based 4-tab main entry (tpl-*.wxml includes)
│   ├── index/          — Standalone 点单 (duplicate of main tab 0 logic)
│   ├── orders/         — Standalone 订单
│   ├── member/         — Standalone 会员
│   ├── profile/        — Standalone 我的 (menu navigates to sub-pages)
│   ├── points/         — 积分商城 (drawer detail + redeem)
│   ├── coupons/        — 兑换券/优惠券 (dual category + status tabs + drawer detail)
│   ├── address/        — 收货地址 (list/form dual mode, CRUD, form validation)
│   └── store/          — 门店信息 (map + store list)
└── images/             — PNG icons for tabs, cart, trash, pickup code
```

## Common Pitfalls

- **Don't use `form.region.length` in WXML** — the region picker value check needs the ternary pattern: `{{form.region.length ? form.region[0] : 'placeholder'}}`. Accessing array index `[0]` on an empty array silently renders nothing.
- **Form validation**: Use a `validateForm()` method returning a string (error message) or `null` (valid). Show via `wx.showToast({ title: error, icon: 'none' })`.
- **Default address uniqueness**: When setting an address as default, iterate and set all others to `isDefault: false`. When deleting a default, promote the first remaining address.
- **Duplicate page logic**: `main.js` and `pages/index/index.js` share near-identical product/cart logic. Changes to product listing or cart behavior must be mirrored in both files. The `main.js` version also handles dietary restrictions in the detail drawer (index.js does not).
- **Tab bar state sync**: Standalone pages update `custom-tab-bar`'s `selected` in `onShow`. The main page manages its own tab state internally via `currentTab`.
- **`wx:if` vs `hidden`**: Use `wx:if` for conditional rendering that toggles infrequently (modes, overlays). `hidden` for frequent toggles.
- **`env(safe-area-inset-bottom)`**: Always add to fixed bottom bars, FABs, and page bottom padding to support notched iPhones.
