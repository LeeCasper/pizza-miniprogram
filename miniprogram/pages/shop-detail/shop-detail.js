// pages/shop-detail/shop-detail.js — 会员商城商品详情（不入购物车，可收藏，单独支付 Phase 2）
const { api, fixImageUrl } = require('../../utils/api');
const { getBackBtnTopBar } = require('../../utils/layout');

Page({
  data: {
    statusBarHeight: 44,
    topBarTotalHeight: 80,
    productId: null,
    product: null,
    images: [],
    loading: true,
    favLoading: false,
  },

  onLoad(options) {
    this.setData(getBackBtnTopBar());
    const id = options.id;
    if (!id) {
      wx.showToast({ title: '商品不存在', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 800);
      return;
    }
    this.setData({ productId: id });
    this.fetchDetail();
  },

  fetchDetail() {
    api.get('/shop/products/' + this.data.productId).then(res => {
      if (res.code === 0 && res.data) {
        const p = res.data;
        const imgs = (Array.isArray(p.images) && p.images.length
          ? p.images
          : (p.main_image ? [p.main_image] : [])
        ).map(u => fixImageUrl(u));
        this.setData({
          product: { ...p, main_image: fixImageUrl(p.main_image) },
          images: imgs,
          loading: false,
        });
      } else {
        this.setData({ loading: false });
        wx.showToast({ title: '商品不存在', icon: 'none' });
      }
    }).catch(() => {
      this.setData({ loading: false });
    });
  },

  onBack() { wx.navigateBack(); },

  onToggleFav() {
    const p = this.data.product;
    if (!p || this.data.favLoading) return;
    const next = !p.isFavorited;
    this.setData({ 'product.isFavorited': next, favLoading: true });
    const req = next
      ? api.post('/shop/favorites/' + p.id)
      : api.del('/shop/favorites/' + p.id);
    req.then(res => {
      if (!res || res.code !== 0) throw new Error('fav failed');
      wx.showToast({ title: next ? '已收藏' : '已取消收藏', icon: 'none' });
    }).catch(() => {
      this.setData({ 'product.isFavorited': !next });
    }).then(() => {
      this.setData({ favLoading: false });
    });
  },

  onBuy() {
    wx.showToast({ title: '下单功能即将上线', icon: 'none' });
  },
});
