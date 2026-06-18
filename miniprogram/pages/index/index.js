// pages/index/index.js
const { api, fixImageUrl } = require('../../utils/api');
const pay = require('../../utils/pay');
const { getSimpleTopBar } = require('../../utils/layout');
const { CATEGORY_ICON_MAP } = require('../../utils/data');
const app = getApp();

Page({
  data: {
    statusBarHeight: 44,
    topBarTotalHeight: 80,
    categories: [],
    products: [],
    filteredProducts: [],
    activeCategory: 'all',
    cart: {},
    cartItems: [],
    cartCount: 0,
    cartTotal: 0,
    cartOpen: false,
    paymentMethod: 'wechat',
    currentTab: 0,
    loading: true,
    error: null,
    banners: [],
    detailProduct: null,
    detailOpen: false,
    detailQuantity: 1,
  },

  onLoad() {
    this.setData(getSimpleTopBar());
    this.fetchData();
  },

  onShow() {
    const tabBar = this.getTabBar();
    if (tabBar && tabBar.data.selected !== 0) {
      tabBar.setData({ selected: 0 });
    }
    this.syncCart();
  },

  // ── 数据加载 ─────────────────────────────────

  fetchData() {
    this.setData({ loading: true, error: null });

    Promise.all([
      api.get('/products'),
      api.get('/products/categories'),
    ]).then(([prodRes, catRes]) => {
      if (prodRes.code === 0 && catRes.code === 0) {
        const products = (prodRes.data || []).map(p => ({
          ...p,
          image: fixImageUrl(p.image),
          quantity: 0,
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
            ...(catRes.data || []).map(c => ({
              ...c,
              icon: CATEGORY_ICON_MAP[c.key] || c.icon,
            })),
          ],
          loading: false,
        });
        this.syncCart();
      } else {
        this.setData({ error: '数据加载失败', loading: false });
      }
    }).catch(() => {
      this.setData({ error: '网络异常，请下拉重试', loading: false });
    });
  },

  // ── 下拉刷新 ─────────────────────────────────

  onPullDownRefresh() {
    this.fetchData();
    wx.stopPullDownRefresh();
  },

  // ── 购物车同步 ──────────────────────────────

  syncCart() {
    const cart = app.globalData.cart;
    const { activeCategory } = this.data;
    const updatedProducts = this.data.products.map(p => ({
      ...p,
      quantity: cart[p.id] ? cart[p.id].quantity : 0
    }));
    const filtered = activeCategory === 'all'
      ? updatedProducts
      : updatedProducts.filter(p => p.category === activeCategory ||
        (p.category_key && p.category_key === activeCategory));
    const cartItems = Object.values(cart);
    this.setData({
      products: updatedProducts,
      filteredProducts: filtered,
      cartItems,
      cartCount: app.globalData.cartCount,
      cartTotal: app.globalData.cartTotal
    });
  },

  updateCart() {
    this.syncCart();
  },

  // ── 分类筛选 ────────────────────────────────

  onCategoryChange(e) {
    const { key } = e.currentTarget.dataset;
    this.setData({ activeCategory: key });
    this.filterProducts();
  },

  filterProducts() {
    const { activeCategory, products } = this.data;
    let filtered;
    if (activeCategory === 'all') {
      filtered = products;
    } else {
      filtered = products.filter(p => p.category === activeCategory ||
        (p.category_key && p.category_key === activeCategory));
    }
    this.setData({ filteredProducts: filtered });
  },

  // ── 购物车操作 ──────────────────────────────

  onAddToCart(e) {
    const { product } = e.currentTarget.dataset;
    app.addToCart(product);
  },

  onDecrease(e) {
    const { id } = e.currentTarget.dataset;
    app.decreaseQuantity(id);
  },

  onClearCart() {
    app.clearCart();
    this.setData({ cartOpen: false });
  },

  onCartBarTap() {
    this.setData({ cartOpen: true });
  },

  onCartClose() {
    this.setData({ cartOpen: false });
  },

  // ── 结账 ────────────────────────────────────

  onCheckout() {
    const { cartCount } = this.data;
    if (cartCount === 0) {
      wx.showToast({ title: '购物车为空', icon: 'none' });
      return;
    }

    const pm = this.data.paymentMethod;

    if (pm === 'balance') {
      const balance = parseFloat((app.globalData.userInfo && app.globalData.userInfo.balance) || 0);
      const cartTotal = parseFloat(this.data.cartTotal);
      if (balance < cartTotal) {
        wx.showModal({
          title: '余额不足',
          content: `当前余额 ¥${balance.toFixed(2)}，订单金额 ¥${cartTotal.toFixed(2)}。\n是否切换为微信支付？`,
          confirmText: '切换支付',
          cancelText: '取消',
          success: (res) => {
            if (res.confirm) { this.setData({ paymentMethod: 'wechat' }); }
          },
        });
        return;
      }
    }

    wx.showLoading({ title: '提交中...' });
    api.post('/orders', { paymentMethod: pm }).then(res => {
      wx.hideLoading();
      if (res.code === 0) {
        const orderData = res.data;
        app.clearCart();
        this.setData({ cartOpen: false });

        if (pm === 'wechat' && orderData.paymentStatus === 'unpaid') {
          pay.payOrder(orderData.order.id).then(() => {
            wx.showToast({ title: '支付成功！', icon: 'success' });
          }).catch((err) => {
            if (!err.cancelled) {
              wx.showToast({ title: '订单已保存，请在订单中心完成支付', icon: 'none', duration: 3000 });
            }
          });
        } else {
          wx.showToast({ title: res.message || '支付成功！', icon: 'success' });
        }
      }
    }).catch(() => {
      wx.hideLoading();
      wx.showToast({ title: '下单失败，请重试', icon: 'none' });
    });
  },

  onSwitchPaymentMethod(e) {
    const { method } = e.currentTarget.dataset;
    this.setData({ paymentMethod: method });
  },

  // ── 通知 ────────────────────────────────────

  onNotify() {
    wx.showToast({ title: '暂无新消息', icon: 'none' });
  },

  // ── Banner轮播 ──────────────────────────────
  onBannerTap(e) {
    const { productId } = e.currentTarget.dataset;
    const product = this.data.products.find(p => p.id === productId);
    if (!product) {
      wx.showToast({ title: '商品详情加载中', icon: 'none' });
      return;
    }
    this.setData({ detailProduct: product, detailOpen: true, detailQuantity: 1 });
  },
  onBannerChange(e) {},

  // ── 产品详情弹窗 ────────────────────────────
  onDetailClose() { this.setData({ detailOpen: false, detailProduct: null }); },
  onDetailAdd() { this.setData({ detailQuantity: Math.min(this.data.detailQuantity + 1, 99) }); },
  onDetailDecrease() { if (this.data.detailQuantity <= 1) return; this.setData({ detailQuantity: this.data.detailQuantity - 1 }); },
  onDetailAddToCart() {
    const { detailProduct, detailQuantity } = this.data;
    if (!detailProduct) return;
    app.addToCart(detailProduct, detailQuantity);
    this.setData({ detailOpen: false, detailProduct: null });
    wx.showToast({ title: '已加入购物车', icon: 'success', duration: 1500 });
  },

  noop() {}
});
