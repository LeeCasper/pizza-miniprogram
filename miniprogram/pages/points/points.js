// pages/points/points.js
const { api, fixImageUrl } = require('../../utils/api');
const app = getApp();
const { getSimpleTopBar } = require('../../utils/layout');

Page({
  data: {
    statusBarHeight: 44,
    topBarTotalHeight: 80,
    products: [],
    userPoints: 0,
    detailProduct: null,
    detailOpen: false,
    loading: true,
  },

  onLoad() {
    this.setData({
      ...getSimpleTopBar(),
      userPoints: app.globalData.userInfo.points || 0,
    });
    this.fetchProducts();
  },

  fetchProducts() {
    this.setData({ loading: true });
    api.get('/points/products').then(res => {
      if (res.code === 0) {
        const products = (res.data || []).map(p => ({ ...p, image: fixImageUrl(p.image) }));
        this.setData({ products, loading: false });
      } else {
        this.setData({ loading: false });
      }
    }).catch(() => {
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    });
  },

  onBack() {
    wx.navigateBack();
  },

  onProductTap(e) {
    const { item } = e.currentTarget.dataset;
    this.setData({ detailProduct: item, detailOpen: true });
  },

  onDetailClose() {
    this.setData({ detailOpen: false, detailProduct: null });
  },

  // 详情页内兑换
  onDetailRedeem() {
    const item = this.data.detailProduct;
    if (!item) return;
    this.doRedeem(item);
  },

  // 列表直接兑换
  onRedeem(e) {
    const { item } = e.currentTarget.dataset;
    if (!item) return;
    this.doRedeem(item);
  },

  doRedeem(item) {
    if (this.data.userPoints < item.points) {
      wx.showToast({ title: '积分不足', icon: 'none' });
      return;
    }
    wx.showModal({
      title: '确认兑换',
      content: `使用 ${item.points} 积分兑换「${item.name}」？`,
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '兑换中...' });
          api.post('/points/redeem', { productId: item.id }).then(result => {
            wx.hideLoading();
            if (result.code === 0) {
              const newPoints = result.data.newPoints;
              this.setData({
                userPoints: newPoints,
                detailOpen: false,
                detailProduct: null,
              });
              // Update global points
              app.globalData.userInfo.points = newPoints;
              wx.showToast({ title: '兑换成功！', icon: 'success' });
            }
          }).catch(() => {
            wx.hideLoading();
            wx.showToast({ title: '兑换失败', icon: 'none' });
          });
        }
      }
    });
  },

  onPointsHistory() {
    if (wx.getStorageSync('_manualLogout')) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '加载中...' });
    api.get('/points/history').then(res => {
      wx.hideLoading();
      if (res.code === 0 && res.data && res.data.length > 0) {
        // Show history items in a simple modal
        const items = res.data.slice(0, 10).map(h => {
          const sign = h.pointsChange > 0 ? '+' : '';
          const date = h.createdAt ? new Date(h.createdAt).toLocaleDateString('zh-CN') : '';
          return `${date}  ${h.reason}  ${sign}${h.pointsChange}`;
        }).join('\n');
        wx.showModal({
          title: '积分明细',
          content: items || '暂无记录',
          showCancel: false,
        });
      } else {
        wx.showToast({ title: '暂无积分记录', icon: 'none' });
      }
    }).catch(() => {
      wx.hideLoading();
    });
  },

  noop() {}
});
