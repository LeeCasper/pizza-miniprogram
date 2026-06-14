// pages/main/main.js
const { api, fixImageUrl } = require('../../utils/api');
const app = getApp();

// ── 分类图标本地映射（数据库存的是 emoji，WXML <image> 无法加载） ──
const CATEGORY_ICON_MAP = {
  all: '/images/all-products.png',
  pizza: '/images/pizza.png',
  durian: '/images/durian-cake.png',
  pineapple: '/images/pineapple-cake.png',
};

// ── 忌口选项（静态配置，来自微信小程序常量） ──────────
const dietaryRestrictions = [
  { key: 'no_spicy', label: '不吃辣' },
  { key: 'no_garlic', label: '不吃蒜' },
  { key: 'no_onion', label: '不吃洋葱' },
  { key: 'no_cilantro', label: '不吃香菜' },
  { key: 'vegetarian', label: '素食' },
  { key: 'peanut_allergy', label: '花生过敏' },
  { key: 'dairy_allergy', label: '乳制品过敏' },
  { key: 'seafood_allergy', label: '海鲜过敏' },
  { key: 'gluten_allergy', label: '麸质过敏' }
];

// ── 会员等级（客户端计算） ──────────────────────────
const TIERS = [
  { key: 'normal',   name: '普通', gradient: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)', textColor: '#1f2937', progressTrackBg: 'rgba(0,0,0,0.1)', progressFillBg: 'rgba(0,0,0,0.5)', badgeBg: 'rgba(0,0,0,0.08)', threshold: 0 },
  { key: 'gold',     name: '黄金', gradient: 'linear-gradient(135deg, #fceabb 0%, #f8b500 100%)', textColor: '#451a03', progressTrackBg: 'rgba(120,53,15,0.12)', progressFillBg: 'rgba(120,53,15,0.7)', badgeBg: 'rgba(255,255,255,0.4)', threshold: 1000 },
  { key: 'platinum', name: '铂金', gradient: 'linear-gradient(135deg, #e2e8f0 0%, #f8fafc 50%, #cbd5e1 100%)', textColor: '#1e293b', progressTrackBg: 'rgba(51,65,85,0.12)', progressFillBg: 'rgba(51,65,85,0.7)', badgeBg: 'rgba(255,255,255,0.5)', threshold: 3000 },
  { key: 'diamond',  name: '钻石', gradient: 'linear-gradient(135deg, #111827 0%, #000000 100%)', textColor: '#ffffff', progressTrackBg: 'rgba(255,255,255,0.2)', progressFillBg: 'rgba(255,255,255,0.9)', badgeBg: 'rgba(255,255,255,0.2)', threshold: 6000 }
];
const TIER_THRESHOLDS = [0, 1000, 3000, 6000];
const ARC_LABELS = [
  { key: 'normal', label: '普通' }, { key: 'gold', label: '圈内新人' },
  { key: 'platinum', label: '资深吃货' }, { key: 'diamond', label: '至尊达人' }
];

function computeTier(points) {
  let tierIndex = 0;
  for (let i = TIER_THRESHOLDS.length - 1; i >= 0; i--) {
    if (points >= TIER_THRESHOLDS[i]) { tierIndex = i; break; }
  }
  const isMax = tierIndex >= TIERS.length - 1;
  const pointsToNext = isMax ? 0 : TIER_THRESHOLDS[tierIndex + 1] - points;
  let tierProgress = 100;
  if (!isMax) {
    const lo = TIER_THRESHOLDS[tierIndex], hi = TIER_THRESHOLDS[tierIndex + 1];
    tierProgress = Math.round(((points - lo) / (hi - lo)) * 100);
  }
  return { tierIndex, pointsToNext, tierProgress, isMax };
}
function getArcOffset(index, activeIndex) {
  const dist = Math.abs(index - activeIndex);
  if (dist === 0) return 0; if (dist === 1) return 22; if (dist === 2) return 76; return 177;
}
function getTrackShift(activeIndex, total) { return Math.round(50 - (activeIndex + 0.5) / total * 100); }
function buildArcLabels(activeIndex) { return ARC_LABELS.map((item, i) => ({ ...item, yOffset: getArcOffset(i, activeIndex) })); }
function getCardSinkOffset(index, activeIndex) {
  const dist = Math.abs(index - activeIndex);
  if (dist === 0) return 0; if (dist === 1) return 24; if (dist === 2) return 56; return 100;
}
function buildTierCards(activeIndex) { return TIERS.map((t, i) => ({ ...t, cardOffset: getCardSinkOffset(i, activeIndex) })); }

Page({
  data: {
    statusBarHeight: app.globalData.statusBarHeight,
    topBarTotalHeight: app.globalData.statusBarHeight + 36,
    scrollViewHeight: 0,
    currentTab: 0,
    tabList: [
      { text: '点单', icon: '/images/tab-menu.png' },
      { text: '订单', icon: '/images/tab-orders.png' },
      { text: '会员', icon: '/images/tab-member.png' },
      { text: '我的', icon: '/images/tab-profile.png' }
    ],
    // 商品
    categories: [],
    products: [], filteredProducts: [], activeCategory: 'all',
    cart: {}, cartItems: [], cartCount: 0, cartTotal: 0, cartOpen: false,
    detailProduct: null, detailOpen: false, detailQuantity: 1,
    dietaryRestrictions, selectedRestrictions: {},
    // 订单
    tabs: [
      { key: 'all', name: '全部' }, { key: 'preparing', name: '制作中' },
      { key: 'waiting', name: '待取餐' }, { key: 'completed', name: '已完成' }
    ],
    activeTab: 'all', orders: [], filteredOrders: [],
    // 个人中心
    userInfo: {}, tierCards: buildTierCards(0), tierGrowthTexts: ['', '', '', ''],
    arcLabels: buildArcLabels(0), trackShift: 0,
    currentTierIndex: 0, userTierIndex: 0, pointsToNext: 0, tierProgress: 0, cardCount: 0,
    editProfileOpen: false, editForm: { name: '', bio: '', avatar: '' },
    // 加载态
    productsLoaded: false, ordersLoaded: false,
  },

  onLoad() {
    const sys = wx.getSystemInfoSync();
    const sh = sys.statusBarHeight;
    const rpx = sys.windowWidth / 750;
    // Tab bar is 100rpx + safe-area, fixed at bottom — reserve its height from scroll area
    const tabBarPx = 100 * rpx;
    const swiperHeight = sys.windowHeight - (sh + 36);
    const scrollViewHeight = swiperHeight - tabBarPx;
    this.setData({ statusBarHeight: sh, topBarTotalHeight: sh + 36, scrollViewHeight });
    this.fetchProducts();
    this.fetchOrders();
    this.loadProfileData();
    this._ready = true;
  },

  onShow() {
    if (this._ready) { this.syncCart(); } else { this._ready = true; }
    this.loadProfileData();
    // Refresh orders when showing
    this.fetchOrders();
  },

  // ── 数据加载 ─────────────────────────────────

  fetchProducts() {
    Promise.all([
      api.get('/products'),
      api.get('/products/categories'),
    ]).then(([prodRes, catRes]) => {
      if (prodRes.code === 0) {
        const cart = app.globalData.cart;
        const products = (prodRes.data || []).map(p => ({
          ...p,
          image: fixImageUrl(p.image),
          quantity: cart[p.id] ? cart[p.id].quantity : 0,
        }));
        this.setData({
          products,
          filteredProducts: products,
          categories: [
            { key: 'all', name: '全部商品', icon: CATEGORY_ICON_MAP.all },
            ...(catRes.code === 0 ? (catRes.data || []) : []).map(c => ({
              ...c,
              icon: CATEGORY_ICON_MAP[c.key] || c.icon,
            })),
          ],
          productsLoaded: true,
        });
      }
    }).catch(() => {});
  },

  fetchOrders() {
    api.get('/orders').then(res => {
      if (res.code === 0) {
        const ordersWithDigits = (res.data || []).map(o => ({
          ...o,
          codeDigits: String(o.pickupCode || '').split(''),
          time: o.createdAt || o.time || '',
        }));
        const { activeTab } = this.data;
        const filtered = activeTab === 'all' ? ordersWithDigits : ordersWithDigits.filter(o => o.status === activeTab);
        this.setData({ orders: ordersWithDigits, filteredOrders: filtered, ordersLoaded: true });
      }
    }).catch(() => {});
  },

  // ── Tab 切换 ────────────────────────────────

  onTabTap(e) {
    const { index } = e.currentTarget.dataset;
    if (this.data.currentTab === index) return;
    this.setData({ currentTab: index });
    if (index === 1) this.fetchOrders();
  },
  onSwiperChange(e) {
    const idx = e.detail.current;
    this.setData({ currentTab: idx });
    if (idx === 1) this.fetchOrders();
  },

  // ── 购物车 ──────────────────────────────────

  syncCart() {
    const cart = app.globalData.cart;
    const { activeCategory } = this.data;
    const updatedProducts = this.data.products.map(p => ({ ...p, quantity: cart[p.id] ? cart[p.id].quantity : 0 }));
    const filtered = activeCategory === 'all' ? updatedProducts : updatedProducts.filter(p => p.category === activeCategory || (p.category_key && p.category_key === activeCategory));
    this.setData({ products: updatedProducts, filteredProducts: filtered, cartItems: Object.values(cart), cartCount: app.globalData.cartCount, cartTotal: app.globalData.cartTotal });
  },
  updateCart() { this.syncCart(); },

  // ── 点单：分类 & 商品 ──────────────────────

  onCategoryChange(e) {
    const { key } = e.currentTarget.dataset;
    const { products } = this.data;
    const filtered = key === 'all' ? products : products.filter(p => p.category === key || (p.category_key && p.category_key === key));
    this.setData({ activeCategory: key, filteredProducts: filtered });
  },
  onAddToCart(e) {
    const { product } = e.currentTarget.dataset;
    const cart = app.globalData.cart;
    const currentQty = cart[product.id] ? cart[product.id].quantity : 0;
    const savedRestrictions = this.data.selectedRestrictions[product.id] || {};
    this.setData({ detailProduct: product, detailOpen: true, detailQuantity: currentQty || 1, selectedRestrictions: { ...this.data.selectedRestrictions, [product.id]: savedRestrictions } });
  },
  onDecrease(e) { app.decreaseQuantity(e.currentTarget.dataset.id); },
  onCartBarTap() { this.setData({ cartOpen: true }); },
  onCartClose() { this.setData({ cartOpen: false }); },
  onClearCart() { app.clearCart(); this.setData({ cartOpen: false }); },

  onCheckout() {
    if (this.data.cartCount === 0) {
      wx.showToast({ title: '购物车为空', icon: 'none' }); return;
    }
    wx.showLoading({ title: '提交中...' });
    api.post('/orders', {}).then(res => {
      wx.hideLoading();
      if (res.code === 0) {
        wx.showToast({ title: res.message || '订单已提交！', icon: 'success' });
        app.clearCart(); this.setData({ cartOpen: false });
      }
    }).catch(() => { wx.hideLoading(); wx.showToast({ title: '下单失败，请重试', icon: 'none' }); });
  },
  onHeroTap() { wx.showToast({ title: '新品推荐即将上线', icon: 'none' }); },
  onPickupToggle() { wx.navigateTo({ url: '/pages/store/store' }); },

  // ── 订单 ────────────────────────────────────

  onTabChange(e) {
    const { key } = e.currentTarget.dataset;
    const { orders } = this.data;
    this.setData({ activeTab: key, filteredOrders: key === 'all' ? [...orders] : orders.filter(o => o.status === key) });
  },
  onShowPickupCode(e) {
    const { id } = e.currentTarget.dataset;
    const update = list => list.map(o => o.id === id ? { ...o, codeRevealed: true } : o);
    this.setData({ filteredOrders: update(this.data.filteredOrders), orders: update(this.data.orders) });
  },
  onHidePickupCode(e) {
    const { id } = e.currentTarget.dataset;
    const update = list => list.map(o => o.id === id ? { ...o, codeRevealed: false } : o);
    this.setData({ filteredOrders: update(this.data.filteredOrders), orders: update(this.data.orders) });
  },
  onOrderDetail(e) { wx.showToast({ title: '订单详情: ' + e.currentTarget.dataset.id, icon: 'none' }); },
  onCancelOrder(e) {
    const { id } = e.currentTarget.dataset;
    wx.showModal({
      title: '取消订单', content: '确定要取消吗？',
      success: (res) => {
        if (res.confirm) {
          api.put('/orders/' + id + '/cancel').then(result => {
            if (result.code === 0) { wx.showToast({ title: '订单已取消', icon: 'success' }); this.fetchOrders(); }
          }).catch(() => { wx.showToast({ title: '取消失败', icon: 'none' }); });
        }
      }
    });
  },

  // ── 会员 ────────────────────────────────────

  onUsePoints() { wx.navigateTo({ url: '/pages/points/points' }); },
  onEarnPoints() { wx.showToast({ title: '下单即可赚取积分', icon: 'none' }); },

  // ── 个人中心 ────────────────────────────────

  loadProfileData() {
    const ui = app.globalData.userInfo;
    const { tierIndex, pointsToNext, tierProgress, isMax } = computeTier(ui.points || 0);
    const tierGrowthTexts = TIERS.map((t, i) => {
      if (i === tierIndex) return isMax ? '已达顶级' : '还需' + pointsToNext + '升级';
      if (i < tierIndex) return '已达成';
      return '还需' + (TIER_THRESHOLDS[i] - (ui.points || 0)) + '升级';
    });
    this.setData({
      userInfo: { ...ui, memberLevel: TIERS[tierIndex].name, balanceText: '¥' + ((ui.balance || 0)).toFixed(2), cardCount: ui.cardCount || 0, bio: ui.bio || '享受美味每一天' },
      tierCards: buildTierCards(tierIndex), tierGrowthTexts, arcLabels: buildArcLabels(tierIndex),
      trackShift: getTrackShift(tierIndex, TIERS.length),
      currentTierIndex: tierIndex, userTierIndex: tierIndex, pointsToNext, tierProgress
    });
    // Background refresh
    api.get('/user/profile').then(res => {
      if (res.code === 0) { app.globalData.userInfo = res.data; wx.setStorageSync('userInfo', res.data); this.loadProfileData(); }
    }).catch(() => {});
  },
  onTierSwiperChange(e) {
    const idx = e.detail.current;
    this.setData({ currentTierIndex: idx, tierCards: buildTierCards(idx), arcLabels: buildArcLabels(idx), trackShift: getTrackShift(idx, TIERS.length) });
  },
  onSelectTier(e) {
    const idx = e.currentTarget.dataset.index;
    if (idx === this.data.currentTierIndex) return;
    this.setData({ currentTierIndex: idx, tierCards: buildTierCards(idx), arcLabels: buildArcLabels(idx), trackShift: getTrackShift(idx, TIERS.length) });
  },
  onMenuItem(e) {
    const { action } = e.currentTarget.dataset;
    const routes = {
      orders: { tab: 1 }, store: '/pages/store/store', member: { tab: 2 },
      points: '/pages/points/points', coupons: '/pages/coupons/coupons',
      address: '/pages/address/address', favorites: '/pages/address/address',
      settings: '/pages/settings/settings', about: '/pages/settings/settings',
      lucky: '__toast__', service: '__toast__'
    };
    const target = routes[action];
    if (!target) { wx.showToast({ title: '功能开发中', icon: 'none' }); return; }
    if (target === '__toast__') {
      const msgs = { lucky: '幸运转盘即将上线，敬请期待！', service: '客服热线: 400-888-8888' };
      wx.showToast({ title: msgs[action] || '功能开发中', icon: 'none', duration: 2000 }); return;
    }
    target.tab !== undefined ? this.setData({ currentTab: target.tab }) : wx.navigateTo({ url: target });
  },
  onLogout() {
    wx.showModal({
      title: '确认退出', content: '确定要退出登录吗？',
      success: (res) => { if (res.confirm) { wx.removeStorageSync('token'); wx.removeStorageSync('userInfo'); wx.showToast({ title: '已退出', icon: 'success' }); } }
    });
  },

  // ── 编辑个人信息 ────────────────────────────

  onChooseAvatar() {
    const that = this;
    wx.chooseImage({
      count: 1, sizeType: ['compressed'], sourceType: ['album', 'camera'],
      success(res) {
        const avatarPath = res.tempFilePaths[0];
        if (that.data.editProfileOpen) { that.setData({ 'editForm.avatar': avatarPath }); return; }
        wx.showLoading({ title: '上传中...' });
        wx.uploadFile({
          url: 'https://www.artaides.com/api/v1/upload/avatar', filePath: avatarPath, name: 'file',
          header: { 'Authorization': 'Bearer ' + (wx.getStorageSync('token') || '') },
          success(result) {
            wx.hideLoading();
            if (result.statusCode === 200) {
              try {
                const data = JSON.parse(result.data);
                if (data.code === 0) { app.globalData.userInfo.avatar = data.data.url; }
              } catch (_) {}
            }
            app.globalData.userInfo.avatar = app.globalData.userInfo.avatar || avatarPath;
            that.loadProfileData(); wx.showToast({ title: '头像已更新', icon: 'success' });
          },
          fail() {
            wx.hideLoading();
            app.globalData.userInfo.avatar = avatarPath;
            that.loadProfileData(); wx.showToast({ title: '头像已更新（本地）', icon: 'success' });
          }
        });
      }
    });
  },
  onOpenEditProfile() {
    const ui = this.data.userInfo;
    this.setData({ editProfileOpen: true, editForm: { name: ui.name || '', bio: ui.bio || '', avatar: ui.avatar || '' } });
  },
  onCloseEditProfile() { this.setData({ editProfileOpen: false }); },
  onNameInput(e) { this.setData({ 'editForm.name': e.detail.value }); },
  onBioInput(e) { this.setData({ 'editForm.bio': e.detail.value }); },
  onSaveProfile() {
    const { editForm } = this.data;
    if (!editForm.name.trim()) { wx.showToast({ title: '请输入昵称', icon: 'none' }); return; }
    const ui = app.globalData.userInfo;
    ui.name = editForm.name.trim(); ui.bio = editForm.bio.trim();
    if (editForm.avatar) ui.avatar = editForm.avatar;
    this.setData({ editProfileOpen: false }); this.loadProfileData();
    api.put('/user/profile', { name: ui.name, bio: ui.bio }).then(() => {
      wx.showToast({ title: '保存成功', icon: 'success' });
    }).catch(() => { wx.showToast({ title: '保存成功（本地）', icon: 'success' }); });
  },

  // ── 产品详情弹窗 ────────────────────────────

  onProductTap(e) {
    const { product } = e.currentTarget.dataset;
    const cart = app.globalData.cart;
    const currentQty = cart[product.id] ? cart[product.id].quantity : 0;
    this.setData({ detailProduct: product, detailOpen: true, detailQuantity: currentQty || 1, selectedRestrictions: { ...this.data.selectedRestrictions, [product.id]: this.data.selectedRestrictions[product.id] || {} } });
  },
  onDetailClose() { this.setData({ detailOpen: false, detailProduct: null }); },
  onDetailAdd() { this.setData({ detailQuantity: Math.min(this.data.detailQuantity + 1, 99) }); },
  onDetailDecrease() { if (this.data.detailQuantity <= 1) return; this.setData({ detailQuantity: this.data.detailQuantity - 1 }); },
  onToggleRestriction(e) {
    const { key } = e.currentTarget.dataset;
    const pid = this.data.detailProduct.id;
    const current = { ...(this.data.selectedRestrictions[pid] || {}) };
    current[key] ? delete current[key] : current[key] = true;
    this.setData({ selectedRestrictions: { ...this.data.selectedRestrictions, [pid]: current } });
  },
  onDetailAddToCart() {
    const { detailProduct, detailQuantity, selectedRestrictions } = this.data;
    if (!detailProduct) return;
    const sel = selectedRestrictions[detailProduct.id] || {};
    const restrictionLabels = Object.keys(sel).map(key => { const r = dietaryRestrictions.find(d => d.key === key); return r ? r.label : key; });
    app.addToCart(detailProduct, detailQuantity, restrictionLabels);
    this.setData({ detailOpen: false, detailProduct: null });
    wx.showToast({ title: '已加入购物车', icon: 'success', duration: 1500 });
  },
  onActivateMember() {
    this.setData({ currentTab: 2 });
  },
  noop() {}
});
