// pages/shop/shop.js — 会员商城（独立页，与 pages/main 商城 tab 同步）
const { api, fixImageUrl } = require('../../utils/api');
const { getSwiperLayout } = require('../../utils/layout');

const CAT_EMOJI_MAP = {
  pizza: '🍕', dessert: '🍰', drink: '🥤', snack: '🍗',
  gift: '🎁', salad: '🥗', bread: '🍞', coffee: '☕',
  all: '🏠',
};

Page({
  data: {
    statusBarHeight: 44,
    topBarTotalHeight: 80,
    scrollViewHeight: 0,
    shopEnabled: true,
    shopNotice: '',
    shopBanners: [],
    shopCategories: [],
    shopActiveCat: 'all',
    shopProducts: [],
    shopFilteredProducts: [],
    loading: true,
  },

  onLoad() {
    const layout = getSwiperLayout();
    const win = wx.getWindowInfo();
    const rpx = win.windowWidth / 750;
    this.setData(layout);
    this.checkShopStatus();
  },

  onShow() {
    const tabBar = this.getTabBar && this.getTabBar();
    if (tabBar && tabBar.data.selected !== 2) {
      tabBar.setData({ selected: 2 });
    }
    if (this.data.shopEnabled && this.data.shopProducts.length) this.fetchShopData();
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
        else this.setData({ loading: false });
      } else {
        this.fetchShopData();
      }
    }).catch(() => {
      this.fetchShopData();
    });
  },

  fetchShopData() {
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

});
