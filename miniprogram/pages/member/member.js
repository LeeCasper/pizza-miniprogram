// pages/member/member.js
const app = getApp();

Page({
  data: {
    statusBarHeight: 44,
    topBarTotalHeight: 80,
  },

  onLoad() {
    const sh = app.globalData.statusBarHeight;
    this.setData({ statusBarHeight: sh, topBarTotalHeight: sh + 36 });
  },

  onUsePoints() {
    wx.navigateTo({ url: '/pages/points/points' });
  },

  onShow() {
    const tabBar = this.getTabBar();
    if (tabBar && tabBar.data.selected !== 2) {
      tabBar.setData({ selected: 2 });
    }
  },

  onEarnPoints() {
    wx.showToast({ title: '下单即可赚取积分', icon: 'none' });
  },
});
