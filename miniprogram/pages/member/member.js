// pages/member/member.js — Stitch "开通会员 (悬浮弹窗版)" 1:1 还原
const { api } = require('../../utils/api');
const app = getApp();
const { getBackBtnTopBar } = require('../../utils/layout');

Page({
  data: {
    statusBarHeight: 44,
    topBarTotalHeight: 80,
    userInfo: {},
    selectedPlan: 'monthly',
    loading: true,
  },

  onLoad() {
    const { statusBarHeight, topBarTotalHeight } = getBackBtnTopBar();
    this.setData({ statusBarHeight, topBarTotalHeight });
    this.loadProfile();
  },

  onShow() {
    this.loadProfile();
    const tabBar = this.getTabBar();
    if (tabBar && tabBar.data.selected !== 2) {
      tabBar.setData({ selected: 2 });
    }
  },

  loadProfile() {
    const ui = app.globalData.userInfo || {};
    this.setData({
      userInfo: {
        memberLevel: ui.memberLevel || '金卡会员',
        points: ui.points || 0,
        avatar: ui.avatar || '',
      },
      loading: false,
    });
    // Background refresh from API
    api.get('/user/profile').then(res => {
      if (res.code === 0) {
        app.globalData.userInfo = res.data;
        wx.setStorageSync('userInfo', res.data);
        this.setData({
          userInfo: {
            memberLevel: res.data.memberLevel || '金卡会员',
            points: res.data.points || 0,
            avatar: res.data.avatar || '',
          },
        });
      }
    }).catch(() => {});
  },

  onBack() {
    wx.navigateBack();
  },

  // ── 方案选择 ──
  onSelectPlan(e) {
    const { plan } = e.currentTarget.dataset;
    this.setData({ selectedPlan: plan });
  },

  // ── 开通会员 ──
  onActivateMember() {
    const plan = this.data.selectedPlan;
    const planNames = { annual: '连续包年 ¥199', monthly: '连续包月 ¥19.9' };
    wx.showModal({
      title: '开通会员',
      content: '确认开通' + (planNames[plan] || '会员') + '？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '开通中...' });
          api.post('/member/subscribe', { plan }).then(result => {
            wx.hideLoading();
            if (result.code === 0) {
              wx.showToast({ title: '开通成功！', icon: 'success' });
              this.loadProfile();
            } else {
              wx.showToast({ title: result.message || '开通失败', icon: 'none' });
            }
          }).catch(() => {
            wx.hideLoading();
            wx.showToast({ title: '开通失败，请重试', icon: 'none' });
          });
        }
      }
    });
  },

  onHelpTap() {
    wx.showToast({ title: '优惠券每周一自动发放至您的账户', icon: 'none', duration: 2000 });
  },

  onTerms() {
    wx.showToast({ title: '会员使用条款', icon: 'none' });
  },

  onPrivacy() {
    wx.showToast({ title: '隐私政策', icon: 'none' });
  },

  onRestore() {
    wx.showToast({ title: '正在恢复购买...', icon: 'none' });
  },

  noop() {}
});
