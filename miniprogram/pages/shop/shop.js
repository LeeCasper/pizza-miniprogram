// pages/shop/shop.js — 会员商城
const { api, fixImageUrl } = require('../../utils/api');
const { getSwiperLayout } = require('../../utils/layout');
const { SHOP_CATEGORIES } = require('../../utils/data');
const app = getApp();

Page({
  data: {
    statusBarHeight: 44,
    topBarTotalHeight: 80,
    scrollViewHeight: 0,
    shopBanners: [],
    shopCategories: SHOP_CATEGORIES,
    shopActiveCat: 'all',
    shopActiveCatName: '精选好物',
    shopProducts: [],
    shopFilteredProducts: [],
    loading: true,
  },

  onLoad() {
    this.setData(getSwiperLayout());
    this.fetchProducts();
  },

  onShow() {
    const tabBar = this.getTabBar();
    if (tabBar && tabBar.data.selected !== 2) {
      tabBar.setData({ selected: 2 });
    }
    this.syncCart();
  },

  fetchProducts() {
    api.get('/products').then(res => {
      if (res.code === 0) {
        const cart = app.globalData.cart;
        const products = (res.data || []).map(p => ({
          ...p,
          image: fixImageUrl(p.image),
          quantity: cart[p.id] ? cart[p.id].quantity : 0,
        }));

        // Generate banners from products with images
        const productsWithImages = products.filter(p => p.image);
        const banners = productsWithImages.slice(0, 3).map((p, i) => ({
          id: i,
          image: p.image,
          title: p.name,
          subtitle: p.desc || '手工现做，新鲜食材',
        }));

        this.setData({
          shopProducts: products,
          shopFilteredProducts: products,
          shopBanners: banners,
          loading: false,
        });
      }
    }).catch(() => {
      this.setData({ loading: false });
    });
  },

  syncCart() {
    const cart = app.globalData.cart;
    const updatedProducts = this.data.shopProducts.map(p => ({
      ...p,
      quantity: cart[p.id] ? cart[p.id].quantity : 0,
    }));
    this.filterByCategory(this.data.shopActiveCat, updatedProducts);
  },

  updateCart() { this.syncCart(); },

  // ── 分类 ──
  onShopCategory(e) {
    const { key } = e.currentTarget.dataset;
    const cat = SHOP_CATEGORIES.find(c => c.key === key);
    this.setData({ shopActiveCat: key, shopActiveCatName: cat ? cat.name : '精选好物' });
    this.filterByCategory(key, this.data.shopProducts);
  },

  filterByCategory(key, products) {
    const filtered = key === 'all'
      ? products
      : products.filter(p => p.category === key || (p.category_key && p.category_key === key));
    this.setData({ shopFilteredProducts: filtered, shopProducts: products });
  },

  // ── 购物车操作 ──
  onShopAddToCart(e) {
    const { product } = e.currentTarget.dataset;
    app.addToCart(product);
  },

  onShopDecrease(e) {
    const { id } = e.currentTarget.dataset;
    app.decreaseQuantity(id);
  },

  // ── Banner ──
  onShopBannerTap(e) {
    wx.showToast({ title: '促销活动即将上线', icon: 'none' });
  },

  // ── 商品详情 ──
  onShopProductTap(e) {
    const { product } = e.currentTarget.dataset;
    wx.showToast({ title: product.name, icon: 'none' });
  },
});
