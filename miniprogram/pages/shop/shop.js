// pages/shop/shop.js — 会员商城（独立页，与 pages/main 商城 tab 同步）
const { api, fixImageUrl } = require('../../utils/api');
const { getSwiperLayout } = require('../../utils/layout');

Page({
  data: {
    statusBarHeight: 44,
    topBarTotalHeight: 80,
    scrollViewHeight: 0,
    shopBanners: [],
    shopCategories: [],
    shopActiveCat: 'all',
    shopActiveCatName: '精选好物',
    shopProducts: [],
    shopFilteredProducts: [],
    loading: true,
  },

  onLoad() {
    const layout = getSwiperLayout();
    this.setData(layout);
    // 商城订单悬浮按钮：紧贴顶栏下方
    const rpx = wx.getWindowInfo().windowWidth / 750;
    this.setData({ floatOrderTop: layout.topBarTotalHeight + 20 * rpx });
    this.fetchShopData();
  },

  onShow() {
    const tabBar = this.getTabBar && this.getTabBar();
    if (tabBar && tabBar.data.selected !== 2) {
      tabBar.setData({ selected: 2 });
    }
    // 已加载过则刷新收藏态（从详情页返回时）
    if (this.data.shopProducts.length) this.fetchShopData();
  },

  fetchShopData() {
    Promise.all([
      api.get('/shop/products'),
      api.get('/shop/categories'),
    ]).then(([prodRes, catRes]) => {
      if (prodRes.code === 0) {
        const products = (prodRes.data || []).map(p => ({
          ...p,
          main_image: fixImageUrl(p.main_image),
        }));
        const withImg = products.filter(p => p.main_image);
        const banners = withImg.slice(0, 3).map((p, i) => ({
          id: i,
          image: p.main_image,
          title: p.name,
          subtitle: p.subtitle || '精选好物，新鲜上架',
        }));
        const cats = [
          { key: 'all', name: '精选好物', icon: '' },
          ...(catRes && catRes.code === 0 ? (catRes.data || []) : []).map(c => ({
            ...c,
            icon: fixImageUrl(c.icon),
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
          loading: false,
        });
      } else {
        this.setData({ loading: false });
      }
    }).catch(() => {
      this.setData({ loading: false });
    });
  },

  onShopCategory(e) {
    const { key } = e.currentTarget.dataset;
    const cat = this.data.shopCategories.find(c => c.key === key);
    const products = this.data.shopProducts;
    const filtered = key === 'all' ? products : products.filter(p => p.shop_category_key === key);
    this.setData({ shopActiveCat: key, shopActiveCatName: cat ? cat.name : '精选好物', shopFilteredProducts: filtered });
  },

  onShopBannerTap() { wx.showToast({ title: '促销活动即将上线', icon: 'none' }); },

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

  onGoOrders() {
    wx.navigateTo({ url: '/pages/shop-orders/shop-orders' });
  },
});
