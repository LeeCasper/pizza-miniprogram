// pages/points/points.js
const { pointsProducts } = require('../../utils/data');
const app = getApp();

Page({
  data: {
    statusBarHeight: 44,
    topBarTotalHeight: 80,
    products: pointsProducts,
    userPoints: 2450,
    detailProduct: null,
    detailOpen: false
  },

  onLoad() {
    const sh = app.globalData.statusBarHeight;
    this.setData({ statusBarHeight: sh, topBarTotalHeight: sh + 36 });
  },

  onBack() {
    wx.navigateBack();
  },

  // 商品点击 — 打开详情弹窗
  onProductTap(e) {
    const { item } = e.currentTarget.dataset;
    this.setData({ detailProduct: item, detailOpen: true });
  },

  // 关闭详情弹窗
  onDetailClose() {
    this.setData({ detailOpen: false, detailProduct: null });
  },

  // 详情页内兑换
  onDetailRedeem() {
    const item = this.data.detailProduct;
    if (!item) return;
    if (this.data.userPoints < item.points) {
      wx.showToast({ title: '积分不足', icon: 'none' });
      return;
    }
    wx.showModal({
      title: '确认兑换',
      content: `使用 ${item.points} 积分兑换「${item.name}」？`,
      success: (res) => {
        if (res.confirm) {
          const newPoints = this.data.userPoints - item.points;
          this.setData({ userPoints: newPoints, detailOpen: false, detailProduct: null });
          wx.showToast({ title: '兑换成功!', icon: 'success' });
        }
      }
    });
  },

  onRedeem(e) {
    const { item } = e.currentTarget.dataset;
    if (this.data.userPoints < item.points) {
      wx.showToast({ title: '积分不足', icon: 'none' });
      return;
    }
    wx.showModal({
      title: '确认兑换',
      content: `使用 ${item.points} 积分兑换「${item.name}」？`,
      success: (res) => {
        if (res.confirm) {
          const newPoints = this.data.userPoints - item.points;
          this.setData({ userPoints: newPoints });
          wx.showToast({ title: '兑换成功!', icon: 'success' });
        }
      }
    });
  },

  onPointsHistory() {
    wx.showToast({ title: '积分明细功能开发中', icon: 'none' });
  },

  noop() {}
});
