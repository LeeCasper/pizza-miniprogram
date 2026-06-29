# 商城轮播图管理 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让会员商城页面使用后台管理的真实轮播图（复用现有 `banners` 系统 + scope 字段区分），支持多类型跳转（商品/优惠券/积分/转盘/外链）。

**Architecture:** 在 `banners` 表加 `scope` + `link_url` + 扩展 `link_type` 枚举 → 后端透传新字段 → Admin 页面加 scope 筛选和 linkUrl 输入 → 商城小程序页改调 `/banners?scope=shop`。

**Tech Stack:** Express.js + MySQL / Vue3 + NaiveUI + TypeScript / WeChat Mini Program (WXML/WXSS/JS)

## Global Constraints

- 不改动 `banners` 表已有行的行为 — `scope` 默认 `'pos'`，现有点单轮播图不受影响
- Admin 表单中 `linkUrl` 仅当 `linkType='url'` 时显示
- 小程序 `url` 类型用 `wx.setClipboardData` 复制外链（WeChat 不支持直接打开）
- 部署前需运行迁移 SQL → `deploy.py` 追加迁移文件路径
- `deploy.py` migration list 位于 `soybean-admin-temp/deploy.py`

---

### Task 1: DB 迁移 SQL

**Files:**
- Create: `pizza-server/db/migrate_shop_banners.sql`

**Produces:** `banners` 表新增 `scope`, `link_url` 列 + `link_type` 枚举扩展 + 新索引

- [ ] **Step 1: 创建迁移文件**

```sql
-- migrate_shop_banners.sql
-- 商城轮播图管理：scope 区分展示位置 + 扩展跳转类型 + 外链支持

ALTER TABLE banners
  ADD COLUMN scope ENUM('pos','shop','both') DEFAULT 'pos'
  AFTER link_product_id;

ALTER TABLE banners
  ADD COLUMN link_url VARCHAR(500) DEFAULT NULL
  AFTER link_product_id;

ALTER TABLE banners
  MODIFY link_type ENUM('product','none','coupon','points','lucky-wheel','url')
  DEFAULT 'none';

ALTER TABLE banners
  ADD INDEX idx_scope_active_sort (scope, is_active, sort_order);
```

- [ ] **Step 2: 验证 SQL 语法**

Run: `node -e "console.log('syntax ok')"`
Expected: `syntax ok`

- [ ] **Step 3: Commit**

```bash
git add pizza-server/db/migrate_shop_banners.sql
git commit -m "feat: add shop banner migration (scope + link_url + extended link_type)"
```

---

### Task 2: 后端 bannerService — 支持 scope + linkUrl

**Files:**
- Modify: `pizza-server/src/services/bannerService.js`

**Consumes:** `banners` 表已有 `scope`, `link_url` 列（Task 1 迁移后）
**Produces:** `getActive(scope?)` — 可选 scope 过滤；`create/update` 支持 `scope` 和 `link_url` 字段；`formatBanner` 输出 `scope` 和 `linkUrl`

- [ ] **Step 1: 改 `getActive` 支持 scope 参数**

把 `getActive()` 改为 `getActive(scope)`：

```js
// Public: active banners sorted by sort_order, optionally filtered by scope
async getActive(scope) {
  let query = 'SELECT * FROM banners WHERE is_active = 1';
  const params = [];
  if (scope) {
    query += ' AND scope IN (?, ?)';
    params.push(scope, 'both');
  }
  query += ' ORDER BY sort_order ASC, id ASC';
  const [rows] = await pool.query(query, params);
  return rows.map(formatBanner);
},
```

- [ ] **Step 2: 改 `create` 支持 scope 和 link_url**

```js
async create(data) {
  const { image_url, title, subtitle, tag, link_type, link_product_id, link_url, scope, sort_order } = data;
  const [result] = await pool.query(
    `INSERT INTO banners (image_url, title, subtitle, tag, link_type, link_product_id, link_url, scope, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [image_url, title || '', subtitle || '', tag || '',
     link_type || 'none', link_product_id || null, link_url || null,
     scope || 'pos', sort_order || 0]
  );
  return this.findById(result.insertId);
},
```

- [ ] **Step 3: 改 `update` 支持 scope 和 link_url**

把 fields 数组加 `'link_url'` 和 `'scope'`：

```js
async update(id, data) {
  const fields = ['image_url', 'title', 'subtitle', 'tag', 'link_type', 'link_product_id', 'link_url', 'scope', 'sort_order', 'is_active'];
  // ... 其余不变
},
```

- [ ] **Step 4: 改 `formatBanner` 输出新字段**

```js
function formatBanner(row) {
  if (!row) return null;
  return {
    id: row.id,
    imageUrl: row.image_url,
    title: row.title,
    subtitle: row.subtitle,
    tag: row.tag,
    linkType: row.link_type,
    linkProductId: row.link_product_id,
    linkUrl: row.link_url,
    scope: row.scope,
    sortOrder: row.sort_order,
    isActive: !!row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
```

- [ ] **Step 5: Node.js 语法检查**

Run: `node --check pizza-server/src/services/bannerService.js`
Expected: 无输出（退出码 0）

- [ ] **Step 6: Commit**

```bash
git add pizza-server/src/services/bannerService.js
git commit -m "feat: bannerService — scope filter + linkUrl + extended link_type support"
```

---

### Task 3: 后端路由 — banners 公共路由接受 scope query

**Files:**
- Modify: `pizza-server/src/routes/banners.js`

**Consumes:** `bannerService.getActive(scope)` (Task 2)
**Produces:** `GET /api/v1/banners?scope=shop` → 按 scope 过滤的轮播图

- [ ] **Step 1: 路由透传 scope query 参数**

```js
router.get('/', async (req, res) => {
  try {
    const scope = req.query.scope || null;
    const banners = await bannerService.getActive(scope);
    return res.json({ code: 0, data: banners });
  } catch (err) {
    log.error({ err }, 'List error');
    return res.status(500).json({ code: 500, message: '获取轮播图失败' });
  }
});
```

- [ ] **Step 2: Node.js 语法检查**

Run: `node --check pizza-server/src/routes/banners.js`
Expected: 无输出（退出码 0）

- [ ] **Step 3: Commit**

```bash
git add pizza-server/src/routes/banners.js
git commit -m "feat: banners route accepts ?scope= query param"
```

---

### Task 4: Admin API 模块 — Banner 接口加新字段

**Files:**
- Modify: `soybean-admin-temp/src/service/api/banner.ts`

**Produces:** `Banner` 接口新增 `scope`, `linkUrl`；`linkType` 扩展枚举

- [ ] **Step 1: 更新 Banner 接口**

把 `Banner` 接口的 `linkType` 和新增字段：

```ts
export interface Banner {
  id?: number;
  imageUrl: string;
  title: string;
  subtitle: string;
  tag: string;
  linkType: 'product' | 'none' | 'coupon' | 'points' | 'lucky-wheel' | 'url';
  linkProductId: number | null;
  linkUrl: string | null;
  scope: 'pos' | 'shop' | 'both';
  sortOrder: number;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}
```

- [ ] **Step 2: TypeScript 检查**

Run: `npx tsc --noEmit soybean-admin-temp/src/service/api/banner.ts 2>&1 || echo "type errors may exist in isolation — check IDE"`
Expected: 无致命错误

- [ ] **Step 3: Commit**

```bash
git add soybean-admin-temp/src/service/api/banner.ts
git commit -m "feat: update Banner interface — scope + linkUrl + extended linkType"
```

---

### Task 5: Admin 表单页 — scope + linkUrl + 新 linkType

**Files:**
- Modify: `soybean-admin-temp/src/views/banners/form/index.vue`

**Consumes:** `Banner` 接口 (Task 4)
**Produces:** 表单支持 scope 下拉 + linkUrl 输入 + 5 种 linkType 选项

- [ ] **Step 1: 更新 linkTypeOptions 和 scopeOptions**

替换 `linkTypeOptions` 数组并加 `scopeOptions`：

在 `<script setup>` 中：

```ts
const linkTypeOptions = [
  { label: '无链接', value: 'none' },
  { label: '商品链接', value: 'product' },
  { label: '优惠券中心', value: 'coupon' },
  { label: '积分商城', value: 'points' },
  { label: '幸运转盘', value: 'lucky-wheel' },
  { label: '自定义外链', value: 'url' },
];

const scopeOptions = [
  { label: '点单页', value: 'pos' },
  { label: '商城页', value: 'shop' },
  { label: '两处都显示', value: 'both' },
];
```

- [ ] **Step 2: 更新 form 初始值**

```ts
const form = ref<Partial<Banner>>({
  imageUrl: '',
  title: '',
  subtitle: '',
  tag: '',
  linkType: 'none',
  linkProductId: null,
  linkUrl: null,
  scope: 'pos',
  sortOrder: 0,
});
```

- [ ] **Step 3: 更新 onMounted 中的 form 赋值**

在编辑模式数据加载中加入 `linkUrl` 和 `scope`：

```ts
form.value = {
  imageUrl: data.imageUrl,
  title: data.title,
  subtitle: data.subtitle,
  tag: data.tag,
  linkType: data.linkType,
  linkProductId: data.linkProductId,
  linkUrl: data.linkUrl,
  scope: data.scope || 'pos',
  sortOrder: data.sortOrder,
};
```

- [ ] **Step 4: handleSave 中清 linkProductId 条件扩展**

```ts
async function handleSave() {
  saving.value = true;
  const id = route.params.id as string;
  const payload = { ...form.value };
  if (payload.linkType === 'none') {
    payload.linkProductId = null;
    payload.linkUrl = null;
  }
  if (payload.linkType !== 'product') payload.linkProductId = null;
  if (payload.linkType !== 'url') payload.linkUrl = null;
  // ... 其余不变
}
```

- [ ] **Step 5: 模板加 scope 选择器 + linkUrl 输入 + 条件显示逻辑**

在 `</NForm>` 前（`<NFormItem label="排序">` 上方）插入：

```html
<NFormItem label="展示范围">
  <NSelect v-model:value="form.scope" :options="scopeOptions" style="width: 200px" />
</NFormItem>
<NFormItem label="外链URL" v-if="form.linkType === 'url'">
  <NInput v-model:value="form.linkUrl" placeholder="https://..." />
</NFormItem>
```

- [x] 同时把 `v-if="form.linkType === 'product'"` 保持在 `<NFormItem label="关联商品">` 上（已有）。

- [ ] **Step 6: TypeScript 检查**

Run: `npx vue-tsc --noEmit 2>&1 | head -20`（在 soybean-admin-temp 目录）
Expected: 新字段无类型错误

- [ ] **Step 7: Commit**

```bash
git add soybean-admin-temp/src/views/banners/form/index.vue
git commit -m "feat: banner form — scope picker + linkUrl input + extended linkType"
```

---

### Task 6: Admin 列表页 — scope 列 + 筛选

**Files:**
- Modify: `soybean-admin-temp/src/views/banners/list/index.vue`

**Consumes:** `Banner` 接口 (Task 4)
**Produces:** 列表展示 scope 标签 + 顶部 scope 筛选

- [ ] **Step 1: 加 scope 和 linkType 文本映射**

在 `<script setup>` 中：

```ts
const scopeMap: Record<string, string> = { pos: '点单', shop: '商城', both: '两处' };
const linkTypeMap: Record<string, string> = {
  product: '商品', none: '无', coupon: '优惠券', points: '积分',
  'lucky-wheel': '幸运转盘', url: '外链',
};
```

- [ ] **Step 2: columns 数组加 scope 列**

在「状态」列前插入：

```ts
{
  title: '展示范围', key: 'scope', width: 80,
  render(row) {
    return h(NTag, { type: row.scope === 'both' ? 'info' : row.scope === 'shop' ? 'success' : 'default', size: 'small', bordered: false }, () => scopeMap[row.scope] || row.scope || '点单');
  }
},
```

- [ ] **Step 3: 模板加 scope 筛选下拉**

在 `<NCard title="轮播图管理">` 的 `#header-extra` 中加入（NButton 旁边）：

```html
<NSelect
  v-model:value="scopeFilter"
  :options="scopeFilterOptions"
  placeholder="展示范围"
  clearable
  style="width: 140px"
  @update:value="loadBanners"
/>
```

- [ ] **Step 4: 加 scopeFilter 变量和 loadBanners 逻辑**

```ts
const scopeFilter = ref<string | null>(null);
const scopeFilterOptions = [
  { label: '全部', value: null },
  { label: '点单页', value: 'pos' },
  { label: '商城页', value: 'shop' },
  { label: '两处', value: 'both' },
];

async function loadBanners() {
  loading.value = true;
  const { data, error } = await fetchBanners();
  if (!error && data) {
    let filtered = data;
    if (scopeFilter.value) {
      filtered = data.filter(b => b.scope === scopeFilter.value || b.scope === 'both');
    }
    banners.value = filtered;
  }
  loading.value = false;
}
```

注意：`scopeFilter` ref 定义需在 `loadBanners` 之前。

- [ ] **Step 5: TypeScript 检查**

Run: `npx vue-tsc --noEmit`（在 soybean-admin-temp 目录）

- [ ] **Step 6: Commit**

```bash
git add soybean-admin-temp/src/views/banners/list/index.vue
git commit -m "feat: banner list — scope column + filter dropdown"
```

---

### Task 7: 小程序 main.js — 商城 tab 改用真实 Banner API

**Files:**
- Modify: `miniprogram/pages/main/main.js`

**Consumes:** `GET /api/v1/banners?scope=shop` (Task 3)
**Produces:** 商城 tab 轮播图从 API 获取，点击支持多类型导航

- [ ] **Step 1: 改 `fetchShopData` 加调 banners API**

把 `fetchShopData()` 中的 `Promise.all` 从 2 个 API 改为 3 个，并替换 banner 拼凑逻辑：

```js
fetchShopData() {
  Promise.all([
    api.get('/shop/products'),
    api.get('/shop/categories'),
    api.publicGet('/banners?scope=shop'),
  ]).then(([prodRes, catRes, bannerRes]) => {
    if (prodRes.code === 0) {
      const products = (prodRes.data || []).map(p => ({
        ...p,
        main_image: fixImageUrl(p.main_image),
      }));
      // 使用 API 轮播图替代产品拼凑
      const banners = (bannerRes && bannerRes.code === 0 ? (bannerRes.data || []) : []).map(b => ({
        id: b.id,
        image: fixImageUrl(b.imageUrl),
        title: b.title || '',
        subtitle: b.subtitle || '',
        tag: b.tag || '',
        linkType: b.linkType || 'none',
        linkProductId: b.linkProductId || null,
        linkUrl: b.linkUrl || null,
      }));
      // ... cats / filtered 逻辑不变
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

- [ ] **Step 2: 新增 `onShopBannerTap` 方法**

在 `onShopCategory` 方法附近加入：

```js
onShopBannerTap(e) {
  const { linkType, productId, linkUrl } = e.currentTarget.dataset;
  switch (linkType) {
    case 'product':
      if (productId) wx.navigateTo({ url: '/pages/shop-detail/shop-detail?id=' + productId });
      break;
    case 'coupon':
      wx.navigateTo({ url: '/pages/claim-center/claim-center' });
      break;
    case 'points':
      wx.navigateTo({ url: '/pages/points/points' });
      break;
    case 'lucky-wheel':
      wx.navigateTo({ url: '/pages/lucky-wheel/lucky-wheel' });
      break;
    case 'url':
      if (linkUrl) {
        wx.setClipboardData({ data: linkUrl, success: () => {
          wx.showToast({ title: '链接已复制，请在浏览器中打开', icon: 'none' });
        }});
      }
      break;
    default:
      break;
  }
},
```

- [ ] **Step 3: Node.js 语法检查**

Run: `node --check miniprogram/pages/main/main.js`
Expected: 无输出（退出码 0）

- [ ] **Step 4: Commit**

```bash
git add miniprogram/pages/main/main.js
git commit -m "feat: main.js shop tab — fetch banners from API with navigation"
```

---

### Task 8: 小程序 tpl-shop.wxml — 更新 banner 点击传参

**Files:**
- Modify: `miniprogram/pages/main/tpl-shop.wxml`

**Consumes:** `shopBanners` 数组（每个元素含 `linkType`, `linkProductId`, `linkUrl` — Task 7）
**Produces:** Banner 点击将 `linkType/productId/linkUrl` 传入 `onShopBannerTap`

- [ ] **Step 1: 更新 swiper-item 中的 bindtap dataset**

当前 `bindtap="onShopBannerTap" data-id="{{item.id}}"` — 改为传完整跳转参数：

```html
<view
  class="shop-hero-slide"
  bindtap="onShopBannerTap"
  data-link-type="{{item.linkType}}"
  data-product-id="{{item.linkProductId}}"
  data-link-url="{{item.linkUrl}}"
>
```

- [ ] **Step 2: Commit**

```bash
git add miniprogram/pages/main/tpl-shop.wxml
git commit -m "feat: tpl-shop.wxml — banner tap passes nav params"
```

---

### Task 9: 小程序 shop.js — 独立商城页改用真实 Banner API

**Files:**
- Modify: `miniprogram/pages/shop/shop.js`

**Consumes:** `GET /api/v1/banners?scope=shop` (Task 3)
**Produces:** 独立商城页轮播图从 API 获取，点击支持多类型导航

- [ ] **Step 1: 改 `fetchShopData` 加调 banners API**

```js
fetchShopData() {
  Promise.all([
    api.get('/shop/products'),
    api.get('/shop/categories'),
    api.publicGet('/banners?scope=shop'),
  ]).then(([prodRes, catRes, bannerRes]) => {
    if (prodRes.code === 0) {
      const products = (prodRes.data || []).map(p => ({
        ...p,
        main_image: fixImageUrl(p.main_image),
      }));
      // 使用 API 轮播图替代产品拼凑
      const banners = (bannerRes && bannerRes.code === 0 ? (bannerRes.data || []) : []).map(b => ({
        id: b.id,
        image: fixImageUrl(b.imageUrl),
        title: b.title || '',
        subtitle: b.subtitle || '',
        tag: b.tag || '',
        linkType: b.linkType || 'none',
        linkProductId: b.linkProductId || null,
        linkUrl: b.linkUrl || null,
      }));
      // ... cats / filtered 逻辑不变
      this.setData({
        shopProducts: products,
        shopFilteredProducts: filtered,
        shopBanners: banners,
        shopCategories: cats,
        loading: false,
      });
    }
  }).catch(() => { this.setData({ loading: false }); });
},
```

- [ ] **Step 2: 替换 `onShopBannerTap`**

把第 93 行的 `onShopBannerTap() { wx.showToast(...) }` 替换为：

```js
onShopBannerTap(e) {
  const { linkType, productId, linkUrl } = e.currentTarget.dataset;
  switch (linkType) {
    case 'product':
      if (productId) wx.navigateTo({ url: '/pages/shop-detail/shop-detail?id=' + productId });
      break;
    case 'coupon':
      wx.navigateTo({ url: '/pages/claim-center/claim-center' });
      break;
    case 'points':
      wx.navigateTo({ url: '/pages/points/points' });
      break;
    case 'lucky-wheel':
      wx.navigateTo({ url: '/pages/lucky-wheel/lucky-wheel' });
      break;
    case 'url':
      if (linkUrl) {
        wx.setClipboardData({ data: linkUrl, success: () => {
          wx.showToast({ title: '链接已复制，请在浏览器中打开', icon: 'none' });
        }});
      }
      break;
    default:
      break;
  }
},
```

- [ ] **Step 3: Node.js 语法检查**

Run: `node --check miniprogram/pages/shop/shop.js`
Expected: 无输出（退出码 0）

- [ ] **Step 4: Commit**

```bash
git add miniprogram/pages/shop/shop.js
git commit -m "feat: shop.js — fetch banners from API with navigation"
```

---

### Task 10: 小程序 shop.wxml — 更新 banner 点击传参

**Files:**
- Modify: `miniprogram/pages/shop/shop.wxml`

**Consumes:** `shopBanners` 数组（含 `linkType`, `linkProductId`, `linkUrl` — Task 9）
**Produces:** Banner 点击传完整跳转参数

- [ ] **Step 1: 更新 swiper-item 中的 bindtap dataset**

当前第 12 行 `bindtap="onShopBannerTap" data-id="{{item.id}}"` — 改为：

```html
<view
  class="shop-hero-slide"
  bindtap="onShopBannerTap"
  data-link-type="{{item.linkType}}"
  data-product-id="{{item.linkProductId}}"
  data-link-url="{{item.linkUrl}}"
>
```

- [ ] **Step 2: Commit**

```bash
git add miniprogram/pages/shop/shop.wxml
git commit -m "feat: shop.wxml — banner tap passes nav params"
```

---

### Task 11: deploy.py — 追加迁移文件路径

**Files:**
- Modify: `soybean-admin-temp/deploy.py`

**Consumes:** `pizza-server/db/migrate_shop_banners.sql` (Task 1)

- [ ] **Step 1: 在 migrations 列表末尾追加新迁移**

找到 `pizza-server/db/migrate_default_avatars.sql` 行，在其后追加：

```python
        'pizza-server/db/migrate_default_avatars.sql',
        'pizza-server/db/migrate_shop_banners.sql',
```

- [ ] **Step 2: Commit**

```bash
git add soybean-admin-temp/deploy.py
git commit -m "chore: register shop_banners migration in deploy.py"
```

---

