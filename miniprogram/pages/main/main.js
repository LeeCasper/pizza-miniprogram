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

// ── 会员等级配置 ──────────────────────────────
// ── 会员等级（API 驱动 + 本地回退）─────────────
const FALLBACK_TIERS = [
  { levelKey: 'silver',    name: '银卡会员',   levelIndex: 1, minSpent:     0, discountRate: 1.00, pointsRewardRate: 1.00, birthdayGift: '生日当月享9折优惠一次',       couponValue:  0, accentColor: '#c0c0c0', bgStartColor: 'rgba(60,60,65,0.88)',  bgEndColor: 'rgba(25,25,30,0.95)', bgImage: '/images/tier-bg-silver.jpg' },
  { levelKey: 'gold',      name: '金卡会员',   levelIndex: 2, minSpent:   200, discountRate: 0.98, pointsRewardRate: 1.00, birthdayGift: '生日当月享8折优惠一次',       couponValue:  5, accentColor: '#f2ca50', bgStartColor: 'rgba(45,42,33,0.88)',  bgEndColor: 'rgba(17,14,7,0.95)', bgImage: '/images/tier-bg-gold.jpg' },
  { levelKey: 'rose_gold', name: '玫瑰金会员', levelIndex: 3, minSpent:  1000, discountRate: 0.95, pointsRewardRate: 1.20, birthdayGift: '生日当月享7折优惠+专属礼物',  couponValue: 10, accentColor: '#e0a2a2', bgStartColor: 'rgba(50,35,35,0.88)',  bgEndColor: 'rgba(20,15,15,0.95)', bgImage: '/images/tier-bg-rosegold.jpg' },
  { levelKey: 'platinum',  name: '铂金会员',   levelIndex: 4, minSpent:  3000, discountRate: 0.90, pointsRewardRate: 1.50, birthdayGift: '生日当月享6折优惠+上门配送',  couponValue: 20, accentColor: '#b4bed2', bgStartColor: 'rgba(35,40,50,0.88)',  bgEndColor: 'rgba(15,17,25,0.95)', bgImage: '/images/tier-bg-platinum.jpg' },
  { levelKey: 'diamond',   name: '钻石会员',   levelIndex: 5, minSpent: 10000, discountRate: 0.85, pointsRewardRate: 2.00, birthdayGift: '生日当月享5折优惠+专属客服',  couponValue: 50, accentColor: '#82c8f0', bgStartColor: 'rgba(20,35,50,0.88)',  bgEndColor: 'rgba(10,15,25,0.95)', bgImage: '/images/tier-bg-diamond.jpg' },
];

function computeTier(totalSpent, tiers) {
  let current = tiers[0], next = tiers[1];
  for (let i = tiers.length - 1; i >= 0; i--) {
    if (totalSpent >= tiers[i].minSpent) { current = tiers[i]; next = tiers[i + 1] || null; break; }
  }
  return { current, next };
}

function buildTierCards(apiTiers, userTier) {
  return apiTiers.map(t => {
    const isActive = t.levelKey === userTier.current.levelKey;
    let progressText = '', actionText = '';
    if (t.levelIndex < userTier.current.levelIndex) {
      progressText = '已达成';
      actionText = t.discountRate < 1 ? '享' + ((1 - t.discountRate) * 100).toFixed(0) + '%折扣' : '查看特权';
    } else if (isActive) {
      if (userTier.next) {
        const diff = (userTier.next.minSpent - (userTier._totalSpent || 0)).toFixed(2);
        progressText = '还差¥' + diff + '升级' + userTier.next.name;
        actionText = '查看权益';
      } else {
        progressText = '已达最高等级';
        actionText = '尊享特权';
      }
    } else {
      const diff = (t.minSpent - (userTier._totalSpent || 0)).toFixed(2);
      progressText = '消费满¥' + t.minSpent + '解锁';
      actionText = '查看权益';
    }
    const discountText = t.discountRate < 1 ? ((1 - t.discountRate) * 100).toFixed(0) + '折' : '';
    return {
      levelKey: t.levelKey, levelIndex: t.levelIndex, name: t.name,
      accentColor: t.accentColor, bgStartColor: t.bgStartColor, bgEndColor: t.bgEndColor,
      bgImage: t.bgImage || null,
      discountRate: t.discountRate, pointsRewardRate: t.pointsRewardRate,
      birthdayGift: t.birthdayGift,
      discountText,
      isActive, progressText, actionText,
    };
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
    userInfo: {}, cardCount: 0,
    editProfileOpen: false, editForm: { name: '', bio: '', avatar: '' },
    announceOpen: false,
    tierCards: [], activeTierIndex: 0,
    // 会员订阅（商城 tab 会员弹窗）
    selectedPlan: 'monthly',
    memberOverlayOpen: false,
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

  // ── 会员订阅（商城 tab） ──────────────────────

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
              this.setData({ memberOverlayOpen: false });
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

  onActivateMember() {
    this.setData({ memberOverlayOpen: true });
  },

  onMemberOverlayClose() {
    this.setData({ memberOverlayOpen: false });
  },

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
    const totalSpent = ui.totalSpent || 0;

    this._ensureTiersLoaded().then(apiTiers => {
      const tierInfo = computeTier(totalSpent, apiTiers);
      tierInfo._totalSpent = totalSpent;
      const tierCards = buildTierCards(apiTiers, tierInfo);
      const activeTierIndex = tierInfo.current.levelIndex - 1;

      this.setData({
        userInfo: { ...ui, balanceText: '¥' + ((ui.balance || 0)).toFixed(2), cardCount: ui.cardCount || 0, bio: ui.bio || '享受美味每一天' },
        tierCards,
        activeTierIndex,
      });
    });
    // Background refresh
    api.get('/user/profile').then(res => {
      if (res.code === 0) { app.globalData.userInfo = res.data; wx.setStorageSync('userInfo', res.data); this.loadProfileData(); }
    }).catch(() => {});
  },

  _ensureTiersLoaded() {
    if (this._apiTiers) return Promise.resolve(this._apiTiers);
    return api.get('/user/member-tiers').then(res => {
      this._apiTiers = (res && res.code === 0 && res.data && res.data.length) ? res.data : FALLBACK_TIERS;
      return this._apiTiers;
    }).catch(() => {
      this._apiTiers = FALLBACK_TIERS;
      return this._apiTiers;
    });
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

  // ── 会员卡轮播 ──────────────────────────────
  onTierChange(e) {
    const idx = e.detail.current;
    const tierCards = this.data.tierCards.map((card, i) => {
      card.isActive = i === idx;
      return card;
    });
    this.setData({ activeTierIndex: idx, tierCards });
  },

  onUpgradeTier(e) {
    const levelKey = e.currentTarget.dataset.levelKey;
    wx.navigateTo({ url: '/pages/tiers/tiers?levelKey=' + levelKey });
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
