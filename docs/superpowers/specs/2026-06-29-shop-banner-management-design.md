# 商城轮播图管理 — 设计文档

**日期**: 2026-06-29
**状态**: 设计完成，待实现

## 1. 问题

会员商城页面（shop Tab + 独立 `/pages/shop/shop`）的轮播图目前从商品图片拼凑生成，无法独立管理。而已有的 `banners` 系统（DB + API + Admin 页面）仅服务点单页。
目标：让商城页也能使用后台管理的真实轮播图，且支持更多跳转类型。

## 2. 方案：复用现有 banners 系统 + 加 scope 区分

### 2.1 数据库

- `banners` 表加 `scope ENUM('pos','shop','both') DEFAULT 'pos'` —— 控制轮播图在哪些页面展示
- `link_type` 枚举扩展为 `'product','none','coupon','points','lucky-wheel','url'`
- 加 `link_url VARCHAR(500) DEFAULT NULL` —— 外链 URL（linkType='url' 时使用）
- 加联合索引 `idx_scope_active_sort (scope, is_active, sort_order)`

迁移文件：`pizza-server/db/migrate_shop_banners.sql`

### 2.2 后端

| 文件 | 改动 |
|------|------|
| `bannerService.js` | `getActive(scope?)` 接受可选 scope 参数；`create()`/`update()` 支持 `scope` + `linkUrl` 新字段；`formatBanner()` 输出新字段 |
| `routes/banners.js` | `GET /api/v1/banners?scope=shop` 透传 scope 参数 |
| `adminApiController.js` | 6 个 handler 透传新字段（所有 handler 已调用 `bannerService`，无需改签名） |

公共 API `GET /api/v1/banners` 不带 scope → 返回全部（向后兼容点单页）；带 `?scope=shop` → 返回 scope 为 `shop` 或 `both` 的记录。

### 2.3 Admin 后台

| 文件 | 改动 |
|------|------|
| `service/api/banner.ts` | `Banner` 接口加 `scope: string`、`linkUrl: string` |
| `views/banners/form/index.vue` | 加 scope 下拉选择器（点单页/商城页/两处都显示）、linkUrl 输入框（仅 linkType=url 时显示）、新 linkType 选项（优惠券中心/积分商城/幸运转盘/自定义外链） |
| `views/banners/list/index.vue` | 新增「展示范围」列 + 顶部 scope 筛选下拉、「跳转类型」列 |

### 2.4 小程序

| 文件 | 改动 |
|------|------|
| `pages/main/main.js` | `fetchShopData()` 加调 `GET /banners?scope=shop`，替换产品拼凑逻辑 |
| `pages/main/tpl-shop.wxml` | 轮播区绑定 `banners` 数据；点击事件改为 `onShopBannerTap` |
| `pages/main/main.wxml` | tpl-shop 的 banner swiper 改为新数据结构 |
| `pages/shop/shop.js` | 加 `loadBanners()` 调 `/banners?scope=shop`；移除旧拼凑逻辑 |
| `pages/shop/shop.wxml` | 同 tpl-shop，轮播绑定真实数据 + 点击导航 |

**跳转逻辑** (`onShopBannerTap`):

| linkType | 行为 |
|----------|------|
| `none` | 无操作 |
| `product` | `wx.navigateTo /pages/shop-detail/shop-detail?id=<linkProductId>` |
| `coupon` | `wx.navigateTo /pages/claim-center/claim-center` |
| `points` | `wx.navigateTo /pages/points/points` |
| `lucky-wheel` | `wx.navigateTo /pages/lucky-wheel/lucky-wheel` |
| `url` | `wx.setClipboardData` 复制外链 + toast "链接已复制，请在浏览器中打开" |

**降级**：API 无轮播图或失败时轮播区隐藏（`wx:if="{{banners.length}}"`），商品列表正常展示，不影响核心功能。

## 3. 数据流

```
Admin 创建/编辑轮播图 → scope='shop' → DB
                                    ↓
小程序 shop 页/tab       → GET /banners?scope=shop
                                    ↓
                    轮播渲染 + 点击 → 根据 linkType 导航
```

## 4. 兼容性

- 旧 `link_type='product'` / `'none'` 行为和 `linkProductId` 逻辑完全不变
- 旧 scope 默认 `'pos'` → 现有点单页轮播图不受影响
- `GET /banners` 不带 scope → 返回全部，向后兼容

## 5. 文件清单

| 层 | 文件 | 操作 |
|------|------|------|
| DB | `pizza-server/db/migrate_shop_banners.sql` | 新建 |
| 后端 | `pizza-server/src/services/bannerService.js` | 改 |
| 后端 | `pizza-server/src/routes/banners.js` | 改 |
| 后端 | `pizza-server/src/controllers/adminApiController.js` | 不改（透传 OK） |
| Admin | `soybean-admin-temp/src/service/api/banner.ts` | 改 |
| Admin | `soybean-admin-temp/src/views/banners/form/index.vue` | 改 |
| Admin | `soybean-admin-temp/src/views/banners/list/index.vue` | 改 |
| 小程序 | `miniprogram/pages/main/main.js` | 改 |
| 小程序 | `miniprogram/pages/main/tpl-shop.wxml` | 改 |
| 小程序 | `miniprogram/pages/main/main.wxss` | 不改 |
| 小程序 | `miniprogram/pages/shop/shop.js` | 改 |
| 小程序 | `miniprogram/pages/shop/shop.wxml` | 改 |
| 小程序 | `miniprogram/pages/shop/shop.wxss` | 不改 |
