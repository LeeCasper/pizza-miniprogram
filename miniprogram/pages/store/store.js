// pages/store/store.js
const app = getApp();

Page({
  data: {
    statusBarHeight: 44,
    topBarTotalHeight: 80
  },

  onLoad() {
    const sh = app.globalData.statusBarHeight;
    const topBarH = sh + 36;
    this.setData({
      statusBarHeight: sh,
      topBarTotalHeight: topBarH
    });
  },

  onBack() {
    wx.navigateBack();
  },

  onContactService() {
    wx.makePhoneCall({ phoneNumber: '01088888888' });
  },

  onStartOrder() {
    wx.switchTab({ url: '/pages/index/index' });
  }
});
