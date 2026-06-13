// pages/main/main.js
const { products, categories, orders, dietaryRestrictions } = require('../../utils/data');
const app = getApp();

const TIERS = [
  {
    key: 'normal',
    name: '普通',
    gradient: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
    textColor: '#1f2937',
    progressTrackBg: 'rgba(0,0,0,0.1)',
    progressFillBg: 'rgba(0,0,0,0.5)',
    badgeBg: 'rgba(0,0,0,0.08)',
    threshold: 0
  },
  {
    key: 'gold',
    name: '黄金',
    gradient: 'linear-gradient(135deg, #fceabb 0%, #f8b500 100%)',
    textColor: '#451a03',
    progressTrackBg: 'rgba(120,53,15,0.12)',
    progressFillBg: 'rgba(120,53,15,0.7)',
    badgeBg: 'rgba(255,255,255,0.4)',
    threshold: 1000
  },
  {
    key: 'platinum',
    name: '铂金',
    gradient: 'linear-gradient(135deg, #e2e8f0 0%, #f8fafc 50%, #cbd5e1 100%)',
    textColor: '#1e293b',
    progressTrackBg: 'rgba(51,65,85,0.12)',
    progressFillBg: 'rgba(51,65,85,0.7)',
    badgeBg: 'rgba(255,255,255,0.5)',
    threshold: 3000
  },
  {
    key: 'diamond',
    name: '钻石',
    gradient: 'linear-gradient(135deg, #111827 0%, #000000 100%)',
    textColor: '#ffffff',
    progressTrackBg: 'rgba(255,255,255,0.2)',
    progressFillBg: 'rgba(255,255,255,0.9)',
    badgeBg: 'rgba(255,255,255,0.2)',
    threshold: 6000
  }
];
const TIER_THRESHOLDS = [0, 1000, 3000, 6000];
const ARC_LABELS = [
  { key: 'normal', label: '普通' },
  { key: 'gold', label: '圈内新人' },
  { key: 'platinum', label: '资深吃货' },
  { key: 'diamond', label: '至尊达人' }
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
    const lo = TIER_THRESHOLDS[tierIndex];
    const hi = TIER_THRESHOLDS[tierIndex + 1];
    tierProgress = Math.round(((points - lo) / (hi - lo)) * 100);
  }
  return { tierIndex, pointsToNext, tierProgress, isMax };
}

function getArcOffset(index, activeIndex) {
  const dist = Math.abs(index - activeIndex);
  // Calculated for 1700rpx circle (radius 850rpx), labels ~171rpx apart
  if (dist === 0) return 0;
  if (dist === 1) return 22;
  if (dist === 2) return 76;
  return 177;
}

function getTrackShift(activeIndex, total) {
  var pos = (activeIndex + 0.5) / total * 100;
  return Math.round(50 - pos);
}

function buildArcLabels(activeIndex) {
  return ARC_LABELS.map((item, i) => ({
    ...item,
    yOffset: getArcOffset(i, activeIndex)
  }));
}

function getCardSinkOffset(index, activeIndex) {
  const dist = Math.abs(index - activeIndex);
  if (dist === 0) return 0;
  if (dist === 1) return 24;
  if (dist === 2) return 56;
  return 100;
}

function buildTierCards(activeIndex) {
  return TIERS.map((t, i) => ({
    ...t,
    cardOffset: getCardSinkOffset(i, activeIndex)
  }));
}

Page({
  data: {
    // 通用
    statusBarHeight: app.globalData.statusBarHeight,
    topBarTotalHeight: app.globalData.statusBarHeight + 36,
    currentTab: 0,

    // Tab 列表
    tabList: [
      { text: '点单', icon: '/images/tab-menu.png' },
      { text: '订单', icon: '/images/tab-orders.png' },
      { text: '会员', icon: '/images/tab-member.png' },
      { text: '我的', icon: '/images/tab-profile.png' }
    ],

    // ---- 首页数据 ----
    categories,
    products: [],
    filteredProducts: [],
    activeCategory: 'all',
    cart: {},
    cartItems: [],
    cartCount: 0,
    cartTotal: 0,
    cartOpen: false,

    // ---- 产品详情 ----
    detailProduct: null,
    detailOpen: false,
    detailQuantity: 1,
    dietaryRestrictions,
    selectedRestrictions: {},

    // ---- 订单数据 ----
    tabs: [
      { key: 'all', name: '全部' },
      { key: 'preparing', name: '制作中' },
      { key: 'waiting', name: '待取餐' },
      { key: 'completed', name: '已完成' }
    ],
    activeTab: 'all',
    orders: [],
    filteredOrders: [],

    // ---- 个人中心数据 ----
    userInfo: {},
    tierCards: buildTierCards(0),
    tierGrowthTexts: ['', '', '', ''],
    arcLabels: buildArcLabels(0),
    trackShift: 0,
    currentTierIndex: 0,
    userTierIndex: 0,
    pointsToNext: 0,
    tierProgress: 0,
    cardCount: 0,
    editProfileOpen: false,
    editForm: { name: '', bio: '', avatar: '' }
  },

  onLoad() {
    const sh = app.globalData.statusBarHeight;
    // 初始化首页数据
    const cart = app.globalData.cart;
    const cartItems = Object.values(cart);
    const initialProducts = products.map(p => ({
      ...p,
      quantity: cart[p.id] ? cart[p.id].quantity : 0
    }));
    // 初始化订单数据（预处理取餐码）
    const ordersWithDigits = orders.map(o => ({
      ...o,
      codeDigits: String(o.pickupCode).split('')
    }));
    this.setData({
      statusBarHeight: sh,
      topBarTotalHeight: sh + 36,
      products: initialProducts,
      filteredProducts: initialProducts,
      cartItems,
      cartCount: app.globalData.cartCount,
      cartTotal: app.globalData.cartTotal,
      orders: ordersWithDigits,
      filteredOrders: ordersWithDigits
    });
    this.loadProfileData();
    this._ready = true;
  },

  onShow() {
    if (this._ready) {
      this.syncCart();
    } else {
      this._ready = true;
    }
    this.loadProfileData();
  },

  // ========== Tab 切换 ==========
  onTabTap(e) {
    const { index } = e.currentTarget.dataset;
    if (this.data.currentTab === index) return;
    this.setData({ currentTab: index });
  },

  onSwiperChange(e) {
    this.setData({ currentTab: e.detail.current });
  },

  // ========== 购物车 ==========
  syncCart() {
    const cart = app.globalData.cart;
    const { activeCategory } = this.data;
    const updatedProducts = this.data.products.map(p => ({
      ...p,
      quantity: cart[p.id] ? cart[p.id].quantity : 0
    }));
    const filtered = activeCategory === 'all'
      ? updatedProducts
      : updatedProducts.filter(p => p.category === activeCategory);
    const cartItems = Object.values(cart);
    this.setData({
      products: updatedProducts,
      filteredProducts: filtered,
      cartItems,
      cartCount: app.globalData.cartCount,
      cartTotal: app.globalData.cartTotal
    });
  },

  updateCart() { this.syncCart(); },

  // ========== 首页：分类 & 商品 ==========
  onCategoryChange(e) {
    const { key } = e.currentTarget.dataset;
    const { products } = this.data;
    const filtered = key === 'all' ? products : products.filter(p => p.category === key);
    this.setData({ activeCategory: key, filteredProducts: filtered });
  },

  onAddToCart(e) {
    // 点击 + 按钮时直接打开产品详情页，让用户选择忌口/口味等
    const { product } = e.currentTarget.dataset;
    const cart = app.globalData.cart;
    const currentQty = cart[product.id] ? cart[product.id].quantity : 0;
    const savedRestrictions = this.data.selectedRestrictions[product.id] || {};
    this.setData({
      detailProduct: product,
      detailOpen: true,
      detailQuantity: currentQty || 1,
      selectedRestrictions: {
        ...this.data.selectedRestrictions,
        [product.id]: savedRestrictions
      }
    });
  },

  onDecrease(e) {
    const { id } = e.currentTarget.dataset;
    app.decreaseQuantity(id);
  },

  onCartBarTap() { this.setData({ cartOpen: true }); },
  onCartClose() { this.setData({ cartOpen: false }); },
  onClearCart() { app.clearCart(); this.setData({ cartOpen: false }); },

  onCheckout() {
    wx.showToast({ title: '订单已提交!', icon: 'success', duration: 2000 });
    app.clearCart();
    this.setData({ cartOpen: false });
  },

  onHeroTap() { wx.showToast({ title: '新品推荐即将上线', icon: 'none' }); },

  onPickupToggle() {
    wx.navigateTo({ url: '/pages/store/store' });
  },

  // ========== 订单 ==========
  onTabChange(e) {
    const { key } = e.currentTarget.dataset;
    const { orders } = this.data;
    const filtered = key === 'all' ? [...orders] : orders.filter(o => o.status === key);
    this.setData({ activeTab: key, filteredOrders: filtered });
  },

  onShowPickupCode(e) {
    const { id } = e.currentTarget.dataset;
    const update = list => list.map(o => o.id === id ? { ...o, codeRevealed: true } : o);
    this.setData({
      filteredOrders: update(this.data.filteredOrders),
      orders: update(this.data.orders)
    });
  },

  onHidePickupCode(e) {
    const { id } = e.currentTarget.dataset;
    const update = list => list.map(o => o.id === id ? { ...o, codeRevealed: false } : o);
    this.setData({
      filteredOrders: update(this.data.filteredOrders),
      orders: update(this.data.orders)
    });
  },

  onOrderDetail(e) {
    wx.showToast({ title: '订单详情: ' + e.currentTarget.dataset.id, icon: 'none' });
  },

  onCancelOrder() {
    wx.showModal({
      title: '取消订单',
      content: '确定要取消吗？',
      success: (res) => {
        if (res.confirm) wx.showToast({ title: '订单已取消', icon: 'success' });
      }
    });
  },

  // ========== 会员 ==========
  onUsePoints() { wx.navigateTo({ url: '/pages/points/points' }); },
  onEarnPoints() { wx.showToast({ title: '下单即可赚取积分', icon: 'none' }); },

  // ========== 个人中心数据 ==========
  loadProfileData() {
    const ui = app.globalData.userInfo;
    const { tierIndex, pointsToNext, tierProgress, isMax } = computeTier(ui.points);

    // Precompute growth text for each tier card (WXML doesn't support string concat)
    const tierGrowthTexts = TIERS.map((t, i) => {
      if (i === tierIndex) {
        if (isMax) return '已达顶级';
        return '还需' + pointsToNext + '升级';
      } else if (i < tierIndex) {
        return '已达成';
      } else {
        const needed = TIER_THRESHOLDS[i] - ui.points;
        return '还需' + needed + '升级';
      }
    });

    this.setData({
      userInfo: {
        ...ui,
        memberLevel: TIERS[tierIndex].name,
        balanceText: '¥' + ui.balance.toFixed(2),
        cardCount: ui.cardCount || 0,
        bio: ui.bio || '享受美味每一天'
      },
      tierCards: buildTierCards(tierIndex),
      tierGrowthTexts,
      arcLabels: buildArcLabels(tierIndex),
      trackShift: getTrackShift(tierIndex, TIERS.length),
      currentTierIndex: tierIndex,
      userTierIndex: tierIndex,
      pointsToNext,
      tierProgress
    });
  },

  // ========== 个人中心 ==========

  onTierSwiperChange(e) {
    const idx = e.detail.current;
    this.setData({
      currentTierIndex: idx,
      tierCards: buildTierCards(idx),
      arcLabels: buildArcLabels(idx),
      trackShift: getTrackShift(idx, TIERS.length)
    });
  },

  onSelectTier(e) {
    const idx = e.currentTarget.dataset.index;
    if (idx === this.data.currentTierIndex) return;
    this.setData({
      currentTierIndex: idx,
      tierCards: buildTierCards(idx),
      arcLabels: buildArcLabels(idx),
      trackShift: getTrackShift(idx, TIERS.length)
    });
  },

  onMenuItem(e) {
    const { action } = e.currentTarget.dataset;
    const routes = {
      orders: { tab: 1 },
      store: '/pages/store/store',
      member: { tab: 2 },
      points: '/pages/points/points',
      coupons: '/pages/coupons/coupons',
      address: '/pages/address/address',
      favorites: '/pages/address/address',
      settings: '/pages/settings/settings',
      about: '/pages/settings/settings',
      lucky: '__toast__',
      service: '__toast__'
    };
    const target = routes[action];
    if (!target) { wx.showToast({ title: '功能开发中', icon: 'none' }); return; }
    if (target === '__toast__') {
      const messages = {
        lucky: '幸运转盘即将上线，敬请期待！',
        service: '客服热线: 400-888-8888'
      };
      wx.showToast({ title: messages[action] || '功能开发中', icon: 'none', duration: 2000 });
      return;
    }
    if (target.tab !== undefined) {
      this.setData({ currentTab: target.tab });
    } else {
      wx.navigateTo({ url: target });
    }
  },

  onLogout() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) wx.showToast({ title: '已退出', icon: 'success' });
      }
    });
  },

  // ========== 编辑个人信息 ==========
  onChooseAvatar() {
    const that = this;
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success(res) {
        const avatarPath = res.tempFilePaths[0];
        if (that.data.editProfileOpen) {
          that.setData({ 'editForm.avatar': avatarPath });
        } else {
          app.globalData.userInfo.avatar = avatarPath;
          that.loadProfileData();
          wx.showToast({ title: '头像已更新', icon: 'success' });
        }
      }
    });
  },

  onOpenEditProfile() {
    const ui = this.data.userInfo;
    this.setData({
      editProfileOpen: true,
      editForm: { name: ui.name || '', bio: ui.bio || '', avatar: ui.avatar || '' }
    });
  },

  onCloseEditProfile() {
    this.setData({ editProfileOpen: false });
  },

  onNameInput(e) {
    this.setData({ 'editForm.name': e.detail.value });
  },

  onBioInput(e) {
    this.setData({ 'editForm.bio': e.detail.value });
  },

  onSaveProfile() {
    const { editForm } = this.data;
    if (!editForm.name.trim()) {
      wx.showToast({ title: '请输入昵称', icon: 'none' });
      return;
    }
    const ui = app.globalData.userInfo;
    ui.name = editForm.name.trim();
    ui.bio = editForm.bio.trim();
    if (editForm.avatar) {
      ui.avatar = editForm.avatar;
    }
    this.setData({ editProfileOpen: false });
    this.loadProfileData();
    wx.showToast({ title: '保存成功', icon: 'success' });
  },

  // ========== 产品详情弹窗 ==========
  onProductTap(e) {
    const { product } = e.currentTarget.dataset;
    const cart = app.globalData.cart;
    const currentQty = cart[product.id] ? cart[product.id].quantity : 0;
    const savedRestrictions = this.data.selectedRestrictions[product.id] || {};
    this.setData({
      detailProduct: product,
      detailOpen: true,
      detailQuantity: currentQty || 1,
      selectedRestrictions: {
        ...this.data.selectedRestrictions,
        [product.id]: savedRestrictions
      }
    });
  },

  onDetailClose() {
    this.setData({ detailOpen: false, detailProduct: null });
  },

  onDetailAdd() {
    const qty = this.data.detailQuantity + 1;
    this.setData({ detailQuantity: Math.min(qty, 99) });
  },

  onDetailDecrease() {
    if (this.data.detailQuantity <= 1) return;
    this.setData({ detailQuantity: this.data.detailQuantity - 1 });
  },

  onToggleRestriction(e) {
    const { key } = e.currentTarget.dataset;
    const pid = this.data.detailProduct.id;
    const current = { ...(this.data.selectedRestrictions[pid] || {}) };
    if (current[key]) {
      delete current[key];
    } else {
      current[key] = true;
    }
    this.setData({
      selectedRestrictions: {
        ...this.data.selectedRestrictions,
        [pid]: current
      }
    });
  },

  onDetailAddToCart() {
    const { detailProduct, detailQuantity, selectedRestrictions } = this.data;
    if (!detailProduct) return;
    // 获取选中的忌口 key 并转换为标签名
    const restrictions = selectedRestrictions[detailProduct.id] || {};
    const selectedKeys = Object.keys(restrictions);
    const restrictionLabels = selectedKeys.map(key => {
      const r = this.data.dietaryRestrictions.find(d => d.key === key);
      return r ? r.label : key;
    });
    app.addToCart(detailProduct, detailQuantity, restrictionLabels);
    this.setData({ detailOpen: false, detailProduct: null });
    wx.showToast({ title: '已加入购物车', icon: 'success', duration: 1500 });
  },

  noop() {}
});
