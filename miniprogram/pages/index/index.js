// pages/index/index.js
const { api } = require('../../utils/api');
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
    currentTab: 0,
    loading: true,
    error: null,
  },

  onLoad() {
    const sh = app.globalData.statusBarHeight;
    this.setData({
      statusBarHeight: sh,
      topBarTotalHeight: sh + 36,
    });
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
          quantity: 0,
        }));
        this.setData({
          products,
          filteredProducts: products,
          categories: catRes.data || [],
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

    wx.showLoading({ title: '提交中...' });
    api.post('/orders', {}).then(res => {
      wx.hideLoading();
      if (res.code === 0) {
        wx.showToast({ title: res.message || '订单已提交！', icon: 'success' });
        app.clearCart();
        this.setData({ cartOpen: false });
      }
    }).catch(() => {
      wx.hideLoading();
      wx.showToast({ title: '下单失败，请重试', icon: 'none' });
    });
  },

  // ── 通知 ────────────────────────────────────

  onNotify() {
    wx.showToast({ title: '暂无新消息', icon: 'none' });
  },

  onHeroTap() {
    wx.showToast({ title: '新品推荐即将上线', icon: 'none' });
  },

  noop() {}
});
