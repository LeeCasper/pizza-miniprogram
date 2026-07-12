// pages/main/main.js
const { api, fixImageUrl } = require('../../utils/api');
const pay = require('../../utils/pay');
const { computeTier } = require('../../utils/tiers');
const { getSwiperLayout } = require('../../utils/layout');
const { formatOrder } = require('../../utils/orders');
const { CATEGORY_ICON_MAP, dietaryRestrictions } = require('../../utils/data');
const { profileMethods, loadProfileCore } = require('../../utils/profileShared');
const CAT_EMOJI_MAP = {
  pizza: '🍕', dessert: '🍰', drink: '🥤', snack: '🍗',
  gift: '🎁', salad: '🥗', bread: '🍞', coffee: '☕',
  all: '🏠',
};
const app = getApp();

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
    paymentMethod: 'wechat', // 'wechat' | 'balance'
    orderNote: '',
    pickupTimeValue: '', pickupTimeText: '', pickupTime: '',
    pickupTimeOpen: false, pickupTimeIndex: '',
    pickupHours: [], pickupMinutes: [],
    pickupPickerValue: [0, 0], pickupPreviewText: '',
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
    editProfileOpen: false, editForm: { name: '', bio: '', avatar: '', birthday: '' },
    announceOpen: false,
    tierCards: [], activeTierIndex: 0,
    birthdayDisplay: '', birthdayCountdown: '', isBirthdayToday: false, hasBirthday: false,
    // 会员订阅（商城 tab 会员弹窗）
    selectedPlan: 'monthly',
    memberOverlayOpen: false,
    shopBanners: [], shopCategories: [],
    shopEnabled: true,
    shopNotice: '',
    shopActiveCat: 'all',
    shopProducts: [], shopFilteredProducts: [], shopLoaded: false,
    // 优惠券
    availableCoupons: [], selectedCoupon: null, couponPickerOpen: false,
    couponDiscountAmount: 0, couponDiscountText: '0.00',
    tierDiscountAmount: 0, tierDiscountText: '0.00', tierName: '',
    totalSavedText: '0.00',
    finalPrice: '0.00',
    // 优惠明细弹窗
    discountPopupOpen: false,
    discountPopupTotal: '0.00',
    discountPopupAmount: '0.00',
    discountPopupPaid: '0.00',
    // 加载态
    productsLoaded: false, ordersLoaded: false,
    showQuickLogin: false,
  },

  // ── 共享 profile 方法（头像、编辑、公告、等级轮播、退出等）──
  ...profileMethods,

  /** 约定接口：头像上传/保存后的数据刷新指向 */
  _reloadProfile() { this.loadProfileData(); },

  onLoad() {
    const layout = getSwiperLayout();
    const win = wx.getWindowInfo();
    const rpx = win.windowWidth / 750;
    this.setData(layout);
    this.fetchProducts();
    this.checkShopStatus();
    this.fetchOrders();
    this.loadProfileData();
    this._ready = true;
  },

  onShow() {
    if (this._ready) { this.syncCart(); } else { this._ready = true; }
    this.loadProfileData();
    // Refresh orders when showing
    this.fetchOrders();
    // Refresh shop favorites when returning from detail page
    if (this.data.currentTab === 2 && this.data.shopLoaded) this.fetchShopData();
  },

  // ── 数据加载 ─────────────────────────────────

  fetchProducts() {
    Promise.all([
      api.publicGet('/products'),
      api.publicGet('/products/categories'),
      api.publicGet('/banners'),
    ]).then(([prodRes, catRes, bannerRes]) => {
      if (prodRes.code === 0) {
        const cart = app.globalData.cart;
        const products = (prodRes.data || []).map(p => ({
          ...p,
          image: fixImageUrl(p.image),
          quantity: cart[p.id] ? cart[p.id].quantity : 0,
        }));
        // 优先用后台配置的轮播图（/banners）；映射成模板字段，图片走 fixImageUrl 补全 /uploads 前缀。
        const apiBanners = (bannerRes && bannerRes.code === 0 ? (bannerRes.data || []) : []).map(b => ({
          id: b.id,
          productId: b.linkType === 'product' ? b.linkProductId : null,
          image: fixImageUrl(b.imageUrl),
          tag: b.tag || '',
          title: b.title || '',
          subtitle: b.subtitle || '',
        }));
        // 回退：后台未配置启用的 banner 时，从产品生成默认轮播，避免首页空白
        const productsWithImages = products.filter(p => p.image);
        const fallbackBanners = productsWithImages.slice(0, 3).map((p, i) => ({
          id: i,
          productId: p.id,
          image: p.image,
          tag: p.tag || '🔥 新品',
          title: p.name,
          subtitle: p.desc || '',
        }));
        while (fallbackBanners.length < 3) {
          fallbackBanners.push({
            id: fallbackBanners.length,
            productId: null,
            image: '/images/pizza.png',
            tag: '🔥 新品',
            title: '王姐手工披萨',
            subtitle: '新鲜食材，匠心制作',
          });
        }
        const banners = apiBanners.length ? apiBanners : fallbackBanners;
        const catList = catRes && catRes.code === 0 ? (catRes.data || []) : [];

        this.setData({
          products,
          filteredProducts: products,
          banners,
          categories: [
            { key: 'all', name: '全部商品', icon: CATEGORY_ICON_MAP.all },
            ...catList.map(c => ({
              ...c,
              icon: CATEGORY_ICON_MAP[c.key] || c.icon,
            })),
          ],
          productsLoaded: true,
        });
      }
    }).catch((err) => {
      console.warn('[main] fetchProducts failed:', err);
    });
  },

  checkShopStatus() {
    api.publicGet('/config/shop').then(res => {
      if (res.code === 0) {
        const enabled = res.data.enabled !== false;
        this.setData({
          shopEnabled: enabled,
          shopNotice: res.data.notice || '会员商城暂时关闭，敬请期待',
        });
        if (enabled) this.fetchShopData();
      } else {
        this.fetchShopData();
      }
    }).catch(() => {
      this.fetchShopData();
    });
  },

  fetchShopData() {
    if (!this.data.shopEnabled) return;
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
        const banners = (bannerRes && bannerRes.code === 0 ? (bannerRes.data || []) : []).map(b => ({
          id: b.id,
          image: fixImageUrl(b.imageUrl),
          title: b.title || '',
          subtitle: b.subtitle || '',
          tag: b.tag || '',
          linkType: b.linkType || 'none',
          linkProductId: b.linkProductId || null,
          linkShopProductId: b.linkShopProductId || null,
          linkUrl: b.linkUrl || null,
        }));
        const cats = [
          { key: 'all', name: '全部', icon: '/images/cat-all.png', emoji: CAT_EMOJI_MAP.all, productCount: products.length },
          ...(catRes && catRes.code === 0 ? (catRes.data || []) : []).map(c => ({
            ...c,
            icon: fixImageUrl(c.icon),
            emoji: CAT_EMOJI_MAP[c.key] || '📦',
            productCount: products.filter(p => p.shop_category_key === c.key).length,
          })),
        ];
        const { shopActiveCat } = this.data;
        const filtered = shopActiveCat === 'all'
          ? products
          : products.filter(p => p.shop_category_key === shopActiveCat);
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

  fetchOrders() {
    if (wx.getStorageSync('_manualLogout')) {
      this.setData({ orders: [], filteredOrders: [], ordersLoaded: true });
      return;
    }
    api.get('/orders').then(res => {
      if (res.code === 0) {
        const ordersWithDigits = (res.data || []).map(o => {
          const fo = formatOrder(o);
          if (fo.items && fo.items.length) {
            fo.items = fo.items.map(it => ({ ...it, image: fixImageUrl(it.image) }));
          }
          return fo;
        });
        const { activeTab } = this.data;
        const filtered = activeTab === 'all' ? ordersWithDigits : ordersWithDigits.filter(o => o.status === activeTab);
        this.setData({ orders: ordersWithDigits, filteredOrders: filtered, ordersLoaded: true });
        this._scheduleCancelDeadlineRefresh(ordersWithDigits);
      }
    }).catch(() => {
      this.setData({ orders: [], filteredOrders: [], ordersLoaded: true });
    });
  },

  /** Auto-refresh when the nearest cancelDeadline expires — inline update canCancel, keep button visible */
  _scheduleCancelDeadlineRefresh(orders) {
    if (this._cancelTimer) { clearTimeout(this._cancelTimer); this._cancelTimer = null; }
    const now = Date.now();
    let nearest = Infinity;
    for (const o of orders) {
      if (o.canCancel && o.cancelDeadline) {
        const dl = new Date(o.cancelDeadline).getTime();
        if (dl > now && dl < nearest) nearest = dl;
      }
    }
    if (nearest < Infinity) {
      this._cancelTimer = setTimeout(() => {
        const orders = this.data.orders.map(o => {
          if (o.canCancel && o.cancelDeadline) {
            const dl = new Date(o.cancelDeadline).getTime();
            if (Date.now() >= dl) return { ...o, canCancel: false };
          }
          return o;
        });
        const { activeTab } = this.data;
        const filtered = activeTab === 'all' ? orders : orders.filter(o => o.status === activeTab);
        this.setData({ orders, filteredOrders: filtered });
      }, nearest - now + 500);
    }
  },

  // ── Tab 切换 ────────────────────────────────

  onTabTap(e) {
    const { index } = e.currentTarget.dataset;
    if (this.data.currentTab === index) return;
    this.setData({ currentTab: index });
    if (index === 1) this.fetchOrders();
    if (index === 2 && !this.data.shopLoaded) this.fetchShopData();
  },
  onSwiperChange(e) {
    const idx = e.detail.current;
    this.setData({ currentTab: idx });
    if (idx === 1) this.fetchOrders();
    if (idx === 2 && !this.data.shopLoaded) this.fetchShopData();
  },

  // ── 购物车 ──────────────────────────────────

  syncCart() {
    const cart = app.globalData.cart;
    const { activeCategory } = this.data;
    const updatedProducts = this.data.products.map(p => ({ ...p, quantity: cart[p.id] ? cart[p.id].quantity : 0 }));
    const filtered = activeCategory === 'all' ? updatedProducts : updatedProducts.filter(p => p.category === activeCategory || (p.category_key && p.category_key === activeCategory));
    this.setData({ products: updatedProducts, filteredProducts: filtered, cartItems: Object.values(cart), cartCount: app.globalData.cartCount, cartTotal: app.globalData.cartTotal });
    this.recalcPrice();
  },
  updateCart() { this.syncCart(); },

  /** Called by app.doAppLogin() when doLogin completes — immediately syncs avatar/name to page */
  updateUserInfo(user) {
    console.log('[main] updateUserInfo — user.avatar:', JSON.stringify(user.avatar));
    var ui = this.data.userInfo || {};
    var avatar = user.avatar || ui.avatar || '';
    this.setData({
      userInfo: { ...ui, avatar: avatar, name: user.name || ui.name, phone: user.phone || ui.phone },
    });
  },

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
    this.setData({
      detailProduct: product,
      detailOpen: true,
      detailQuantity: currentQty || 1,
      selectedRestrictions: { ...this.data.selectedRestrictions, [product.id]: this.data.selectedRestrictions[product.id] || {} }
    });
  },
  onDecrease(e) { app.decreaseQuantity(e.currentTarget.dataset.id); },
  // 购物车内「+」：直接加一件（onAddToCart 是给列表用的「打开详情抽屉」，不能复用，否则在结算弹窗里会把详情弹到背后且数量不增）
  onCartIncrease(e) { app.addToCart(e.currentTarget.dataset.product); },
  onCartBarTap() { this.setData({ cartOpen: true }); this.fetchAvailableCoupons(); this.recalcPrice(); },
  onCartClose() { this.setData({ cartOpen: false, couponPickerOpen: false }); },
  onClearCart() { app.clearCart(); this.setData({ cartOpen: false, selectedCoupon: null, couponPickerOpen: false, pickupTime: '', pickupTimeText: '', pickupTimeValue: '', orderNote: '' }); },

  onCheckout() {
    if (this.data.cartCount === 0) {
      wx.showToast({ title: '购物车为空', icon: 'none' }); return;
    }

    const pm = this.data.paymentMethod;

    // Balance payment: warn if balance might not be enough (use discounted price)
    if (pm === 'balance') {
      const balance = parseFloat((app.globalData.userInfo && app.globalData.userInfo.balance) || 0);
      const finalTotal = parseFloat(this.data.finalPrice);
      if (balance < finalTotal) {
        wx.showModal({
          title: '余额不足',
          content: `当前余额 ¥${balance.toFixed(2)}，应付金额 ¥${finalTotal.toFixed(2)}。\n是否切换为微信支付？`,
          confirmText: '切换支付',
          cancelText: '取消',
          success: (res) => {
            if (res.confirm) {
              this.setData({ paymentMethod: 'wechat' });
            }
          },
        });
        return;
      }
    }

    if (!this.data.pickupTime) {
      wx.showToast({ title: '请选择预约取餐时间', icon: 'none' });
      return;
    }

    const payload = { paymentMethod: pm };
    if (this.data.selectedCoupon) {
      payload.couponId = this.data.selectedCoupon.id;
    }
    payload.pickupTime = this.data.pickupTime;
    if (this.data.orderNote.trim()) {
      payload.note = this.data.orderNote.trim();
    }

    wx.showLoading({ title: '提交中...' });
    api.post('/orders', payload).then(res => {
      wx.hideLoading();
      if (res.code === 0) {
        const orderData = res.data;
        app.clearCart();
        this.setData({ cartOpen: false, selectedCoupon: null, couponPickerOpen: false, pickupTime: '', pickupTimeText: '', pickupTimeValue: '', orderNote: '' });

        // If wechat payment, initiate payment flow
        if (pm === 'wechat' && orderData.paymentStatus === 'unpaid') {
          const orderPaidAmount = parseFloat(orderData.order.paidAmount || orderData.order.total || 0);
          console.log('[onCheckout] orderPaidAmount=', orderPaidAmount, 'totalSpent before=', app.globalData.userInfo && app.globalData.userInfo.totalSpent);
          // Optimistic: update growth value immediately
          if (orderPaidAmount > 0 && app.globalData.userInfo) {
            app.globalData.userInfo.totalSpent = (app.globalData.userInfo.totalSpent || 0) + orderPaidAmount;
            console.log('[onCheckout] optimistic totalSpent=', app.globalData.userInfo.totalSpent);
            this.loadProfileData();
          }
          pay.payOrder(orderData.order.id).then(() => {
            wx.showToast({ title: '支付成功！', icon: 'success' });
            console.log('[onCheckout] payOrder resolved, refreshing');
            this.fetchOrders();
            this.loadProfileData();
          }).catch((err) => {
            if (!err.cancelled) {
              if (orderPaidAmount > 0 && app.globalData.userInfo) {
                app.globalData.userInfo.totalSpent = Math.max(0, (app.globalData.userInfo.totalSpent || 0) - orderPaidAmount);
              }
              this.loadProfileData();
              wx.showToast({ title: '订单已保存，请在订单中心完成支付', icon: 'none', duration: 3000 });
            } else {
              if (orderPaidAmount > 0 && app.globalData.userInfo) {
                app.globalData.userInfo.totalSpent = Math.max(0, (app.globalData.userInfo.totalSpent || 0) - orderPaidAmount);
              }
              this.loadProfileData();
            }
            this.fetchOrders();
          });
        } else {
          wx.showToast({ title: res.message || '支付成功！', icon: 'success' });
          this.fetchOrders();
        }
      }
    }).catch(() => {
      wx.hideLoading();
      wx.showToast({ title: '下单失败，请重试', icon: 'none' });
    });
  },

  onNoteInput(e) {
    this.setData({ orderNote: e.detail.value });
  },

  onSwitchPaymentMethod(e) {
    const { method } = e.currentTarget.dataset;
    this.setData({ paymentMethod: method });
  },

  _buildPickupPicker() {
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const minTime = new Date(now.getTime() + 10 * 60000);
    const minH = minTime.getHours();
    const minM = minTime.getMinutes();

    const hours = [];
    for (let h = minH; h <= 21; h++) hours.push(pad(h));
    const minutes = [];
    for (let i = 0; i < 60; i++) minutes.push(pad(i));

    let initMi = 0;
    if (hours.length > 0 && parseInt(hours[0]) === minH) {
      initMi = Math.max(0, minM);
    }

    const preview = `${hours[0]}:${minutes[initMi]}`;
    this.setData({
      pickupHours: hours, pickupMinutes: minutes,
      pickupPickerValue: [0, initMi], pickupPreviewText: preview,
    });
  },

  onPickupTimeTap() {
    this._buildPickupPicker();
    this.setData({ pickupTimeOpen: true, pickupTimeIndex: '' });
  },

  onClosePickupTime() { this.setData({ pickupTimeOpen: false }); },

  onPickupPickerChange(e) {
    const [hi, mi] = e.detail.value;
    const pad = n => String(n).padStart(2, '0');
    this.setData({
      pickupPickerValue: [hi, mi],
      pickupPreviewText: `${pad(this.data.pickupHours[hi])}:${pad(this.data.pickupMinutes[mi])}`,
    });
  },

  onPickupConfirm() {
    const [hi, mi] = this.data.pickupPickerValue;
    const pad = n => String(n).padStart(2, '0');
    const h = this.data.pickupHours[hi];
    const m = this.data.pickupMinutes[mi];
    const timeStr = `${pad(h)}:${pad(m)}`;
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const pickupDate = new Date(`${today}T${timeStr}:00`);
    if (pickupDate.getTime() < now.getTime() + 10 * 60000) {
      wx.showToast({ title: '制作需要10分钟，请选择稍晚的时间', icon: 'none' });
      return;
    }
    this.setData({
      pickupTimeValue: timeStr,
      pickupTimeText: `今天 ${timeStr}`,
      pickupTime: pickupDate.toISOString(),
      pickupTimeOpen: false,
    });
  },

  onPickupQuick(e) {
    const { key } = e.currentTarget.dataset;
    const mins = { m10: 10, m20: 20, m30: 30 };
    const target = new Date(Date.now() + (mins[key] + 10) * 60000);
    const pad = n => String(n).padStart(2, '0');
    const timeStr = `${pad(target.getHours())}:${pad(target.getMinutes())}`;
    const today = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`;
    this.setData({
      pickupTimeValue: timeStr,
      pickupTimeText: `今天 ${timeStr}`,
      pickupTime: new Date(`${today}T${timeStr}:00`).toISOString(),
      pickupTimeIndex: key,
      pickupTimeOpen: false,
    });
  },

  // ── 优惠券 ──────────────────────────────────

  fetchAvailableCoupons() {
    api.get('/coupons?category=discount&status=available').then(res => {
      if (res.code === 0) {
        const cartTotal = parseFloat(this.data.cartTotal) || 0;
        const coupons = (res.data || [])
          .filter(c => c.category === 'discount')
          .map(c => ({
            ...c,
            minSpend: parseFloat(c.minSpend || 0),
            disabled: parseFloat(c.minSpend || 0) > 0 && cartTotal < parseFloat(c.minSpend || 0),
          }));
        this.setData({ availableCoupons: coupons });
        this.recalcPrice();
      }
    }).catch(() => {});
  },

  onOpenCouponPicker() {
    if (this.data.availableCoupons.length === 0 && !this._couponsFetched) {
      this._couponsFetched = true;
      this.fetchAvailableCoupons();
    }
    this.setData({ couponPickerOpen: true });
  },
  onCloseCouponPicker() {
    this.setData({ couponPickerOpen: false });
  },

  onSelectCoupon(e) {
    const couponId = parseInt(e.currentTarget.dataset.couponId);
    if (couponId === 0) {
      // "不使用优惠券"
      this.setData({ selectedCoupon: null, couponPickerOpen: false });
      this.recalcPrice();
      return;
    }
    const coupon = this.data.availableCoupons.find(c => c.id === couponId);
    if (coupon && !coupon.disabled) {
      this.setData({ selectedCoupon: coupon, couponPickerOpen: false });
      this.recalcPrice();
    }
  },

  recalcPrice() {
    const cartTotal = parseFloat(this.data.cartTotal) || 0;
    if (cartTotal <= 0) {
      this.setData({ couponDiscountAmount: 0, couponDiscountText: '0.00', tierDiscountAmount: 0, tierDiscountText: '0.00', tierName: '', finalPrice: '0.00' });
      return;
    }

    const coupon = this.data.selectedCoupon;
    let couponDiscount = 0;

    if (coupon) {
      // minSpend 校验：不满足则自动取消
      if (coupon.minSpend > 0 && cartTotal < coupon.minSpend) {
        this.setData({ selectedCoupon: null });
        return this.recalcPrice();
      }
      switch (coupon.discountType) {
        case 'fixed_amount':
          couponDiscount = parseFloat(coupon.discountValue) || 0;
          break;
        case 'percentage': {
          const pct = parseFloat(coupon.discountValue) || 0;
          couponDiscount = cartTotal * pct / 100;
          if (coupon.maxDiscount != null) couponDiscount = Math.min(couponDiscount, parseFloat(coupon.maxDiscount));
          break;
        }
        case 'buy_one_get_one': {
          const items = Object.values(app.globalData.cart);
          if (items.length > 0) couponDiscount = Math.min(...items.map(i => i.price));
          break;
        }
        case 'half_price': {
          const items = Object.values(app.globalData.cart);
          if (items.length > 0) {
            const cheapest = items.reduce((min, i) => i.price < min.price ? i : min, items[0]);
            couponDiscount = cheapest.price * 0.5 * cheapest.quantity;
          }
          break;
        }
        case 'free_delivery':
          couponDiscount = 0;
          break;
      }
      couponDiscount = Math.min(couponDiscount, cartTotal);
    }

    // 会员折扣（叠加在优惠券之后）
    const ui = app.globalData.userInfo || {};
    const qualifyingAmount = parseFloat(ui.totalSpent || 0);
    const tiers = this._cachedTiers || [];
    let tierDiscount = 0;
    let tierName = '';

    if (tiers.length > 0) {
      const tierInfo = computeTier(qualifyingAmount, tiers, ui.memberLevel);
      const rate = tierInfo.current.discountRate || 1;
      if (rate < 1) {
        const afterCoupon = cartTotal - couponDiscount;
        tierDiscount = Math.round(afterCoupon * (1 - rate) * 100) / 100;
        tierName = tierInfo.current.name;
      }
    }

    const totalDiscount = couponDiscount + tierDiscount;
    const final = Math.max(0, cartTotal - totalDiscount);

    // 同步更新优惠券列表中的 disabled 状态
    const updatedCoupons = this.data.availableCoupons.map(c => ({
      ...c,
      disabled: c.minSpend > 0 && cartTotal < c.minSpend,
    }));

    this.setData({
      availableCoupons: updatedCoupons,
      couponDiscountAmount: couponDiscount,
      couponDiscountText: couponDiscount.toFixed(2),
      tierDiscountAmount: tierDiscount,
      tierDiscountText: tierDiscount.toFixed(2),
      tierName,
      totalSavedText: (couponDiscount + tierDiscount).toFixed(2),
      finalPrice: final.toFixed(2),
    });
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
  onPayOrder(e) {
    const { id } = e.currentTarget.dataset;
    const pay = require('../../utils/pay');
    // Get paidAmount for optimistic growth update
    const order = (this.data.orders || []).find(o => o.id === id);
    const paidAmount = order ? (order.paidAmount || 0) : 0;
    console.log('[onPayOrder] id=', id, 'paidAmount=', paidAmount, 'totalSpent before=', app.globalData.userInfo && app.globalData.userInfo.totalSpent);

    // Optimistic: update growth value IMMEDIATELY (before payment flow, like recharge does)
    if (paidAmount > 0 && app.globalData.userInfo) {
      app.globalData.userInfo.totalSpent = (app.globalData.userInfo.totalSpent || 0) + paidAmount;
      console.log('[onPayOrder] optimistic totalSpent=', app.globalData.userInfo.totalSpent);
      this.loadProfileData();
    } else {
      console.log('[onPayOrder] SKIP optimistic: paidAmount=', paidAmount, 'hasUserInfo=', !!app.globalData.userInfo);
    }

    pay.payOrder(id).then((result) => {
      wx.showToast({ title: '支付成功！', icon: 'success' });
      console.log('[onPayOrder] payOrder resolved, refreshing');
      this.fetchOrders();
      this.loadProfileData();
      // If server hasn't confirmed callback yet, refresh again after delay
      if (result && result.status === 'pending') {
        setTimeout(() => {
          this.fetchOrders();
          this.loadProfileData();
        }, 3000);
      }
    }).catch((err) => {
      if (!err.cancelled) {
        // Revert optimistic update on payment failure
        if (paidAmount > 0 && app.globalData.userInfo) {
          app.globalData.userInfo.totalSpent = Math.max(0, (app.globalData.userInfo.totalSpent || 0) - paidAmount);
        }
        this.loadProfileData();
        wx.showToast({ title: '支付失败，请重试', icon: 'none' });
      } else {
        // User cancelled — revert optimistic update
        if (paidAmount > 0 && app.globalData.userInfo) {
          app.globalData.userInfo.totalSpent = Math.max(0, (app.globalData.userInfo.totalSpent || 0) - paidAmount);
        }
        this.loadProfileData();
      }
    });
  },
  onPickupComplete(e) {
    const { id } = e.currentTarget.dataset;
    wx.showModal({
      title: '确认取餐',
      content: '确认已到店取餐吗？',
      confirmText: '已取餐',
      cancelText: '再等等',
      confirmColor: '#C0563A',
      success: (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '处理中...' });
        api.put('/orders/' + id + '/complete').then(result => {
          wx.hideLoading();
          if (result.code === 0) {
            wx.showToast({ title: '已确认取餐', icon: 'success' });
            this.fetchOrders();
          } else {
            wx.showToast({ title: result.message || '操作失败', icon: 'none' });
            this.fetchOrders();
          }
        }).catch(() => {
          wx.hideLoading();
          wx.showToast({ title: '操作失败', icon: 'none' });
        });
      },
    });
  },

  onCancelOrder(e) {
    const { id, paid } = e.currentTarget.dataset;
    const isPaid = paid === true || paid === 'true';
    const content = isPaid ? '取消后将自动退款到原支付方式，确定取消吗？' : '确定要取消此订单吗？';
    wx.showModal({
      title: '取消订单', content,
      success: (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '处理中...' });
        api.put('/orders/' + id + '/cancel').then(result => {
          wx.hideLoading();
          if (result.code === 0) {
            const msg = result.refund
              ? (result.refund.method === 'balance' ? '已取消，退款已到账' : '已取消，微信退款处理中')
              : '订单已取消';
            wx.showToast({ title: msg, icon: 'success', duration: 2000 });
            this.fetchOrders();
            if (isPaid) this.loadProfileData(); // refresh balance/points
          } else {
            wx.showToast({ title: result.message || '取消失败', icon: 'none' });
            this.fetchOrders(); // refresh to update canCancel state
          }
        }).catch(() => { wx.hideLoading(); wx.showToast({ title: '取消失败', icon: 'none' }); });
      }
    });
  },

  onCancelDisabled() {
    wx.showToast({ title: '下单超过1分钟，无法取消', icon: 'none' });
  },

  // ── 优惠明细弹窗 ──
  onShowDiscount(e) {
    const { total, discount, paid } = e.currentTarget.dataset;
    this.setData({
      discountPopupOpen: true,
      discountPopupTotal: parseFloat(total).toFixed(2),
      discountPopupAmount: parseFloat(discount).toFixed(2),
      discountPopupPaid: parseFloat(paid).toFixed(2),
    });
  },
  onCloseDiscount() {
    this.setData({ discountPopupOpen: false });
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
    const products = this.data.shopProducts;
    const filtered = key === 'all' ? products : products.filter(p => p.shop_category_key === key);
    this.setData({ shopActiveCat: key, shopFilteredProducts: filtered });
  },
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
  onShopProductTap(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({ url: '/pages/shop-detail/shop-detail?id=' + id });
  },
  onShopToggleFav(e) {
    const { id } = e.currentTarget.dataset;
    const target = this.data.shopProducts.find(p => p.id === id);
    if (!target) return;
    const next = !target.isFavorited;
    const apply = (val) => (list) => list.map(p => (p.id === id ? { ...p, isFavorited: val } : p));
    this.setData({
      shopProducts: apply(next)(this.data.shopProducts),
      shopFilteredProducts: apply(next)(this.data.shopFilteredProducts),
    });
    const req = next ? api.post('/shop/favorites/' + id) : api.del('/shop/favorites/' + id);
    req.then(res => {
      if (!res || res.code !== 0) throw new Error('fav failed');
    }).catch(() => {
      this.setData({
        shopProducts: apply(!next)(this.data.shopProducts),
        shopFilteredProducts: apply(!next)(this.data.shopFilteredProducts),
      });
      wx.showToast({ title: '操作失败', icon: 'none' });
    });
  },

  // ── 个人中心 ────────────────────────────────

  loadProfileData() {
    loadProfileCore(this, {
      beforeMerge(freshUi, cachedUi) {
        // Protect optimistic totalSpent: never decrease with stale server data
        const cur = cachedUi.totalSpent || 0;
        if ((freshUi.totalSpent || 0) < cur) freshUi.totalSpent = cur;
      },
      afterLoad(apiTiers) {
        this._cachedTiers = apiTiers;
        this.recalcPrice();
      },
    });
  },

  onMenuItem(e) {
    const { action } = e.currentTarget.dataset;
    const routes = {
      orders: { tab: 1 }, store: '/pages/store/store', shop: { tab: 2 },
      points: '/pages/points/points', coupons: '/pages/coupons/coupons',
      address: '/pages/address/address', favorites: '/pages/favorites/favorites',
      settings: '/pages/settings/settings', about: '/pages/settings/settings',
      recharge: '/pages/recharge/recharge',
      claimcenter: '/pages/claim-center/claim-center',
      lucky: '/pages/lucky-wheel/lucky-wheel', service: '__toast__',
      shopOrders: '/pages/shop-orders/shop-orders', logistics: '/pages/shop-logistics/shop-logistics'
    };
    const target = routes[action];
    if (!target) { wx.showToast({ title: '功能开发中', icon: 'none' }); return; }
    if (target === '__toast__') {
      const msgs = { service: '客服热线: 400-888-8888' };
      wx.showToast({ title: msgs[action] || '功能开发中', icon: 'none', duration: 2000 }); return;
    }
    target.tab !== undefined ? this.setData({ currentTab: target.tab }) : wx.navigateTo({ url: target });
  },

  onClaimCenter() {
    wx.navigateTo({ url: '/pages/claim-center/claim-center' });
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
    // 直接设置数量（非累加），避免从详情页重复添加
    const cart = app.globalData.cart;
    cart[detailProduct.id] = { ...detailProduct, quantity: detailQuantity, restrictions: restrictionLabels };
    app.updateCartData();
    api.post('/cart/items', { productId: detailProduct.id, quantity: detailQuantity, restrictions: restrictionLabels }).catch(() => {});
    this.setData({ detailOpen: false, detailProduct: null });
    wx.showToast({ title: '已加入购物车', icon: 'success', duration: 1500 });
  },
});
