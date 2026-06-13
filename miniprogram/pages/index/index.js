// pages/index/index.js
const { products, categories } = require('../../utils/data');
const app = getApp();

Page({
  data: {
    statusBarHeight: 44,
    topBarTotalHeight: 80,
    categories,
    products: [],
    filteredProducts: [],
    activeCategory: 'all',
    cart: {},
    cartItems: [],
    cartCount: 0,
    cartTotal: 0,
    cartOpen: false,
    currentTab: 0
  },

  onLoad() {
    const sh = app.globalData.statusBarHeight;
    // 首次加载：一次性完成所有数据初始化，避免多次 setData 闪烁
    const cart = app.globalData.cart;
    const cartItems = Object.values(cart);
    const initialProducts = products.map(p => ({
      ...p,
      quantity: cart[p.id] ? cart[p.id].quantity : 0
    }));
    this.setData({
      statusBarHeight: sh,
      topBarTotalHeight: sh + 36,
      products: initialProducts,
      filteredProducts: initialProducts,
      cartItems,
      cartCount: app.globalData.cartCount,
      cartTotal: app.globalData.cartTotal
    });
    this._cartReady = true;
  },

  onShow() {
    // 仅在需要时更新 TabBar 选中态（tabBar 已在点击时立即更新）
    const tabBar = this.getTabBar();
    if (tabBar && tabBar.data.selected !== 0) {
      tabBar.setData({ selected: 0 });
    }
    // 避免首次加载时重复同步（onLoad 已完成）
    if (this._cartReady) {
      this.syncCart();
    } else {
      this._cartReady = true;
    }
  },

  // 同步购物车（单次 setData，避免多次渲染闪烁）
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

  updateCart() {
    this.syncCart();
  },

  // 分类筛选
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
      filtered = products.filter(p => p.category === activeCategory);
    }
    this.setData({ filteredProducts: filtered });
  },

  // 加入购物车
  onAddToCart(e) {
    const { product } = e.currentTarget.dataset;
    app.addToCart(product);
  },

  // 减少数量
  onDecrease(e) {
    const { id } = e.currentTarget.dataset;
    app.decreaseQuantity(id);
  },

  // 清空购物车
  onClearCart() {
    app.clearCart();
    this.setData({ cartOpen: false });
  },

  // 打开/关闭购物车
  onCartBarTap() {
    this.setData({ cartOpen: true });
  },

  onCartClose() {
    this.setData({ cartOpen: false });
  },

  // 结账
  onCheckout() {
    wx.showToast({
      title: '订单已提交!',
      icon: 'success',
      duration: 2000
    });
    app.clearCart();
    this.setData({ cartOpen: false });
  },

  // 通知
  onNotify() {
    wx.showToast({ title: '暂无新消息', icon: 'none' });
  },

  // Banner点击
  onHeroTap() {
    wx.showToast({ title: '新品推荐即将上线', icon: 'none' });
  },

  noop() {}
});
