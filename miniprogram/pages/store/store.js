// pages/store/store.js
const { api } = require('../../utils/api');
const app = getApp();

Page({
  data: {
    statusBarHeight: 44,
    topBarTotalHeight: 80,
    store: null,
    loading: true,
  },

  onLoad() {
    const sh = app.globalData.statusBarHeight;
    const topBarH = sh + 36;
    this.setData({
      statusBarHeight: sh,
      topBarTotalHeight: topBarH,
    });
    this.fetchStore();
  },

  fetchStore() {
    this.setData({ loading: true });
    api.get('/stores').then(res => {
      if (res.code === 0 && res.data && res.data.length > 0) {
        this.setData({ store: res.data[0], loading: false });
      } else {
        this.setData({ loading: false });
      }
    }).catch(() => {
      this.setData({ loading: false });
    });
  },

  onBack() {
    wx.navigateBack();
  },

  onContactService() {
    const phone = this.data.store ? this.data.store.phone : '01088888888';
    wx.makePhoneCall({ phoneNumber: phone });
  },

  onStartOrder() {
    wx.switchTab({ url: '/pages/index/index' });
  }
});
