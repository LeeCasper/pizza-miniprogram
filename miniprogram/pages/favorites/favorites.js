// pages/favorites/favorites.js — 我的收藏（会员商城）
const { api, fixImageUrl } = require('../../utils/api');
const { getBackBtnTopBar } = require('../../utils/layout');

Page({
  data: {
    statusBarHeight: 44,
    topBarTotalHeight: 80,
    favorites: [],
    loading: true,
  },

  onLoad() {
    this.setData(getBackBtnTopBar());
  },

  onShow() {
    // 每次进入/返回都刷新（详情页取消收藏后列表同步）
    this.fetchFavorites();
  },

  fetchFavorites() {
    if (wx.getStorageSync('_manualLogout')) {
      this.setData({ favorites: [], loading: false });
      return;
    }
    api.get('/shop/favorites').then(res => {
      if (res.code === 0) {
        const favorites = (res.data || []).map(p => ({
          ...p,
          main_image: fixImageUrl(p.main_image),
        }));
        this.setData({ favorites, loading: false });
      } else {
        this.setData({ loading: false });
      }
    }).catch(() => {
      this.setData({ loading: false });
    });
  },

  onBack() { wx.navigateBack(); },

  onTapProduct(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({ url: '/pages/shop-detail/shop-detail?id=' + id });
  },

  onRemove(e) {
    const { id } = e.currentTarget.dataset;
    const prev = this.data.favorites;
    // 乐观移除
    this.setData({ favorites: prev.filter(p => p.id !== id) });
    api.del('/shop/favorites/' + id).then(res => {
      if (!res || res.code !== 0) throw new Error('remove failed');
      wx.showToast({ title: '已取消收藏', icon: 'none' });
    }).catch(() => {
      this.setData({ favorites: prev });
    });
  },
});
