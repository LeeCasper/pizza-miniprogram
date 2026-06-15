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

// ── 会员等级（Stitch 设计稿 1:1） ──────────────────
const TIERS = [
  { key: 'normal',   name: '普通', arcLabel: '普通',     gradient: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)', textColor: '#1f2937', badgeBg: 'rgba(0,0,0,0.08)',    threshold: 0,    progressTrack: 'rgba(0,0,0,0.1)',   progressFill: 'rgba(0,0,0,0.5)' },
  { key: 'gold',     name: '黄金', arcLabel: '圈内新人', gradient: 'linear-gradient(135deg, #fceabb 0%, #f8b500 100%)', textColor: '#451a03', badgeBg: 'rgba(255,255,255,0.4)', threshold: 1000, progressTrack: 'rgba(120,53,15,0.1)', progressFill: 'rgba(120,53,15,0.8)' },
  { key: 'platinum', name: '铂金', arcLabel: '资深吃货', gradient: 'linear-gradient(135deg, #e2e8f0 0%, #f8fafc 50%, #cbd5e1 100%)', textColor: '#1e293b', badgeBg: 'rgba(255,255,255,0.5)', threshold: 3000, progressTrack: 'rgba(30,41,59,0.1)', progressFill: 'rgba(30,41,59,0.7)' },
  { key: 'diamond',  name: '钻石', arcLabel: '至尊达人', gradient: 'linear-gradient(135deg, #111827 0%, #000000 100%)', textColor: '#ffffff', badgeBg: 'rgba(255,255,255,0.2)', threshold: 6000, progressTrack: 'rgba(255,255,255,0.2)', progressFill: 'rgba(255,255,255,0.8)' }
];
const TIER_THRESHOLDS = [0, 1000, 3000, 6000];

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

function buildTierCards(userTierIndex, userPoints) {
  return TIERS.map((t, i) => {
    const isCurrent = i === userTierIndex;
    const isLocked = i > userTierIndex;
    const isUnlocked = i < userTierIndex;
    let growthText = '';
    if (isCurrent && i < TIERS.length - 1) {
      growthText = '成长值' + userPoints + ' 还需' + (TIER_THRESHOLDS[i + 1] - userPoints) + '升级';
    } else if (isCurrent) {
      growthText = '成长值' + userPoints + ' 已达最高等级';
    } else if (isLocked) {
      growthText = '成长值0 还需' + (TIER_THRESHOLDS[i] - (i > 0 ? TIER_THRESHOLDS[i - 1] : 0)) + '升级';
    } else {
      growthText = '已解锁全部权益';
    }
    let progressPercent = 100;
    if (isCurrent && i < TIERS.length - 1) {
      const lo = TIER_THRESHOLDS[i], hi = TIER_THRESHOLDS[i + 1];
      progressPercent = Math.round(((userPoints - lo) / (hi - lo)) * 100);
    } else if (isLocked) {
      progressPercent = 0;
    }
    return {
      key: t.key, name: t.name, gradient: t.gradient, textColor: t.textColor,
      badgeBg: t.badgeBg, threshold: t.threshold, progressTrack: t.progressTrack,
      progressFill: t.progressFill,
      isCurrent, isLocked, isUnlocked,
      growthText, progressPercent,
      lv: 'Lv' + i
    };
  });
}

function buildArcLabels(activeIndex) {
  return TIERS.map((t, i) => {
    const dist = Math.abs(i - activeIndex);
    let offsetY = 0;
    if (dist === 1) offsetY = 16;
    else if (dist === 2) offsetY = 36;
    else if (dist === 3) offsetY = 48;
    return { key: t.key, label: t.arcLabel, active: i === activeIndex, offsetY };
  });
}

Page({
  data: {
    statusBarHeight: app.globalData.statusBarHeight,
    topBarTotalHeight: app.globalData.statusBarHeight + 36,
    scrollViewHeight: 0,
    currentTab: 0,
    tabList: [
      { text: '点单', icon: '/images/tab-menu.png' },
      { text: '订单', icon: '/images/tab-orders.png' },
      { text: '商城', icon: '/images/tab-member.png' },
      { text: '我的', icon: '/images/tab-profile.png' }
    ],
    // 商品
    categories: [],
    products: [], filteredProducts: [], activeCategory: 'all',
    banners: [],
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
    userInfo: {}, tierCards: buildTierCards(0, 0),
    arcLabels: buildArcLabels(0), activeTierIndex: 0, userTierIndex: 0, arcOffset: 0, cardCount: 0,
    editProfileOpen: false, editForm: { name: '', bio: '', avatar: '' },
    announceOpen: false,
    // 会员订阅
    selectedPlan: 'monthly',
    memberOverlayOpen: false,
    // 商城
    shopBanners: [], shopCategories: [
      { key: 'all', name: '全部', icon: '🔥' },
      { key: 'pizza', name: '披萨', icon: '🍕' },
      { key: 'durian', name: '榴莲', icon: '🍈' },
      { key: 'pineapple', name: '菠萝', icon: '🍍' },
      { key: 'drink', name: '饮品', icon: '🥤' },
      { key: 'dessert', name: '甜点', icon: '🍰' },
      { key: 'snack', name: '小食', icon: '🍟' },
    ],
    shopActiveCat: 'all', shopActiveCatName: '精选好物',
    shopProducts: [], shopFilteredProducts: [],
    shopFlashDeal: null,
    // 加载态
    productsLoaded: false, ordersLoaded: false,
  },

  onLoad() {
    const win = wx.getWindowInfo();
    const sh = win.statusBarHeight;
    const rpx = win.windowWidth / 750;
    // Tab bar is 100rpx + safe-area, fixed at bottom — reserve its height from scroll area
    const tabBarPx = 100 * rpx;
    const swiperHeight = win.windowHeight - (sh + 36);
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

  onReady() {
    this.onMemberSwiperReady();
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
        // 从产品生成轮播图数据
        const productsWithImages = products.filter(p => p.image);
        const banners = productsWithImages.slice(0, 3).map((p, i) => ({
          id: i,
          productId: p.id,
          image: p.image,
          tag: p.tag || '🔥 新品',
          title: p.name,
          subtitle: p.desc || '',
        }));
        // 若产品图不足，补充默认占位
        while (banners.length < 3) {
          banners.push({
            id: banners.length,
            productId: null,
            image: '/images/pizza.png',
            tag: '🔥 新品',
            title: '王姐手工披萨',
            subtitle: '新鲜食材，匠心制作',
          });
        }

        this.setData({
          products,
          filteredProducts: products,
          banners,
          categories: [
            { key: 'all', name: '全部商品', icon: CATEGORY_ICON_MAP.all },
            ...(catRes.code === 0 ? (catRes.data || []) : []).map(c => ({
              ...c,
              icon: CATEGORY_ICON_MAP[c.key] || c.icon,
            })),
          ],
          productsLoaded: true,
          shopProducts: products,
          shopFilteredProducts: products,
          shopBanners: banners,
          shopFlashDeal: (() => {
            const fp = products.find(p => p.originalPrice);
            return fp ? { desc: fp.name + ' 限时立减' + (fp.originalPrice - fp.price).toFixed(1) + '元', productId: fp.id } : null;
          })(),
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
    // Also sync shop data
    const updatedShopProducts = this.data.shopProducts.map(p => ({ ...p, quantity: cart[p.id] ? cart[p.id].quantity : 0 }));
    const shopFiltered = this.data.shopActiveCat === 'all' ? updatedShopProducts : updatedShopProducts.filter(p => p.category === this.data.shopActiveCat || (p.category_key && p.category_key === this.data.shopActiveCat));
    this.setData({ products: updatedProducts, filteredProducts: filtered, shopProducts: updatedShopProducts, shopFilteredProducts: shopFiltered, cartItems: Object.values(cart), cartCount: app.globalData.cartCount, cartTotal: app.globalData.cartTotal });
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
  // ── Banner轮播 ──────────────────────────────
  onBannerTap(e) {
    const { productId } = e.currentTarget.dataset;
    const product = this.data.products.find(p => p.id === productId);
    if (!product) {
      wx.showToast({ title: '商品详情加载中', icon: 'none' });
      return;
    }
    const cart = app.globalData.cart;
    const currentQty = cart[product.id] ? cart[product.id].quantity : 0;
    this.setData({
      detailProduct: product,
      detailOpen: true,
      detailQuantity: currentQty || 1,
      selectedRestrictions: { ...this.data.selectedRestrictions, [product.id]: this.data.selectedRestrictions[product.id] || {} }
    });
  },
  onBannerChange(e) {
    // swiper change event, can track current banner index if needed
  },
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

  // ── 会员订阅 ────────────────────────────────

  onSelectPlan(e) {
    const { plan } = e.currentTarget.dataset;
    this.setData({ selectedPlan: plan });
  },

  onMemberSubscribe() {
    const plan = this.data.selectedPlan;
    const planNames = { annual: '连续包年 ¥199', monthly: '连续包月 ¥19.9' };
    wx.showModal({
      title: '开通会员',
      content: '确认开通' + (planNames[plan] || '会员') + '？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '开通中...' });
          api.post('/member/subscribe', { plan }).then(result => {
            wx.hideLoading();
            if (result.code === 0) {
              wx.showToast({ title: '开通成功！', icon: 'success' });
              this.loadProfileData();
            } else {
              wx.showToast({ title: result.message || '开通失败', icon: 'none' });
            }
          }).catch(() => {
            wx.hideLoading();
            wx.showToast({ title: '开通失败，请重试', icon: 'none' });
          });
        }
      }
    });
  },

  onMemberHelp() {
    wx.showToast({ title: '优惠券每周一自动发放至您的账户', icon: 'none', duration: 2000 });
  },

  onMemberTerms() {
    wx.showToast({ title: '会员使用条款', icon: 'none' });
  },

  onMemberPrivacy() {
    wx.showToast({ title: '隐私政策', icon: 'none' });
  },

  onMemberRestore() {
    wx.showToast({ title: '正在恢复购买...', icon: 'none' });
  },

  onUsePoints() { wx.navigateTo({ url: '/pages/points/points' }); },
  onEarnPoints() { wx.showToast({ title: '下单即可赚取积分', icon: 'none' }); },

  // ── 商城 ──────────────────────────────────────

  onShopCategory(e) {
    const { key } = e.currentTarget.dataset;
    const cat = this.data.shopCategories.find(c => c.key === key);
    const products = this.data.shopProducts;
    const filtered = key === 'all' ? products : products.filter(p => p.category === key || (p.category_key && p.category_key === key));
    this.setData({ shopActiveCat: key, shopActiveCatName: cat ? cat.name : '精选好物', shopFilteredProducts: filtered });
  },
  onShopAddToCart(e) { app.addToCart(e.currentTarget.dataset.product); },
  onShopDecrease(e) { app.decreaseQuantity(e.currentTarget.dataset.id); },
  onShopBannerTap() { wx.showToast({ title: '促销活动即将上线', icon: 'none' }); },
  onFlashTap() {
    const deal = this.data.shopFlashDeal;
    if (deal && deal.productId) {
      const product = this.data.shopProducts.find(p => p.id === deal.productId);
      if (product) { app.addToCart(product); wx.showToast({ title: '已加入购物车', icon: 'success' }); }
    }
  },
  onShopProductTap(e) {
    const { product } = e.currentTarget.dataset;
    const cart = app.globalData.cart;
    const currentQty = cart[product.id] ? cart[product.id].quantity : 0;
    this.setData({
      detailProduct: product, detailOpen: true, detailQuantity: currentQty || 1,
      selectedRestrictions: { ...this.data.selectedRestrictions, [product.id]: this.data.selectedRestrictions[product.id] || {} }
    });
  },
  // Sync shop cart quantities
  syncShopCart() {
    const cart = app.globalData.cart;
    const updated = this.data.shopProducts.map(p => ({ ...p, quantity: cart[p.id] ? cart[p.id].quantity : 0 }));
    const filtered = this.data.shopActiveCat === 'all' ? updated : updated.filter(p => p.category === this.data.shopActiveCat || (p.category_key && p.category_key === this.data.shopActiveCat));
    this.setData({ shopProducts: updated, shopFilteredProducts: filtered });
  },

  // ── 个人中心 ────────────────────────────────

  loadProfileData() {
    const ui = app.globalData.userInfo;
    const { tierIndex } = computeTier(ui.points || 0);
    this.setData({
      userInfo: { ...ui, memberLevel: TIERS[tierIndex].name, balanceText: '¥' + ((ui.balance || 0)).toFixed(2), cardCount: ui.cardCount || 0, bio: ui.bio || '享受美味每一天' },
      tierCards: buildTierCards(tierIndex, ui.points || 0),
      arcLabels: buildArcLabels(tierIndex),
      activeTierIndex: tierIndex, userTierIndex: tierIndex,
      arcOffset: -(tierIndex * 100)
    });
    // Background refresh
    api.get('/user/profile').then(res => {
      if (res.code === 0) { app.globalData.userInfo = res.data; wx.setStorageSync('userInfo', res.data); this.loadProfileData(); }
    }).catch(() => {});
  },
  // ── 会员卡片横向滚动 + 弧线联动 ──────────────
  onTierCardsScroll(e) {
    if (this._scrollTimer) clearTimeout(this._scrollTimer);
    this._scrollTimer = setTimeout(() => {
      const scrollLeft = e.detail.scrollLeft;
      const cardWidth = e.detail.scrollWidth / 4;
      const centerPos = scrollLeft + (this._swiperWidth || 375) / 2;
      let activeIndex = 0, minDist = Infinity;
      for (let i = 0; i < 4; i++) {
        const cardCenter = (i + 0.5) * cardWidth;
        const dist = Math.abs(centerPos - cardCenter);
        if (dist < minDist) { minDist = dist; activeIndex = i; }
      }
      if (activeIndex !== this.data.activeTierIndex) {
        this.setData({
          activeTierIndex: activeIndex,
          arcLabels: buildArcLabels(activeIndex),
          arcOffset: -(activeIndex * 100)
        });
      }
    }, 80);
  },

  onArcLabelTap(e) {
    const idx = parseInt(e.currentTarget.dataset.index);
    if (idx === this.data.activeTierIndex) return;
    this.setData({
      activeTierIndex: idx,
      arcLabels: buildArcLabels(idx),
      arcOffset: -(idx * 100)
    });
    if (this._scrollTimer) clearTimeout(this._scrollTimer);
    const cardWidth = (this._swiperWidth || 375) * 0.85;
    const gap = 16;
    const query = wx.createSelectorQuery();
    query.select('#tierCardsScroll').node((res) => {
      if (res && res[0]) res[0].scrollTo({ left: idx * (cardWidth + gap), animated: true });
    }).exec();
  },

  onMemberSwiperReady() {
    const query = wx.createSelectorQuery();
    query.select('.member-tier-section').boundingClientRect((rect) => {
      if (rect) this._swiperWidth = rect.width;
    }).exec();
  },
  onMenuItem(e) {
    const { action } = e.currentTarget.dataset;
    const routes = {
      orders: { tab: 1 }, store: '/pages/store/store', shop: { tab: 2 },
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
    this.setData({ memberOverlayOpen: true });
  },
  onMemberOverlayClose() {
    this.setData({ memberOverlayOpen: false });
  },
  // ── 公告浮窗 ──────────────────────────────
  onAnnounceToggle() {
    const open = !this.data.announceOpen;
    this.setData({ announceOpen: open });
    if (this._announceTimer) clearTimeout(this._announceTimer);
    if (open) {
      this._announceTimer = setTimeout(() => {
        this.setData({ announceOpen: false });
      }, 8000);
    }
  },
  onAnnounceClose() {
    this.setData({ announceOpen: false });
    if (this._announceTimer) clearTimeout(this._announceTimer);
  },
  noop() {}
});
