// pages/profile/profile.js
const { getSimpleTopBar } = require('../../utils/layout');
const { profileMethods, loadProfileCore } = require('../../utils/profileShared');
const app = getApp();

Page({
  data: {
    statusBarHeight: 44,
    topBarTotalHeight: 80,
    userInfo: {},
    cardCount: 0,
    editProfileOpen: false,
    editForm: { name: '', bio: '', avatar: '', birthday: '' },
    announceOpen: false,
    tierCards: [],
    activeTierIndex: 0,
    birthdayDisplay: '',
    birthdayCountdown: '',
    isBirthdayToday: false,
    hasBirthday: false,
    gridPage: 0, gridSwiperHeight: 380,
  },

  // ── 共享 profile 方法（头像、编辑、公告、等级轮播、退出等）──
  ...profileMethods,

  /** 约定接口：头像上传/保存后的数据刷新指向 */
  _reloadProfile() { this.loadUserData(); },

  onLoad() {
    this.setData(getSimpleTopBar(app.globalData.statusBarHeight));
    this.loadUserData();
  },

  onShow() {
    const tabBar = this.getTabBar();
    if (tabBar && tabBar.data.selected !== 3) {
      tabBar.setData({ selected: 3 });
    }
    this.loadUserData();
  },

  loadUserData() {
    loadProfileCore(this);
  },

  onMenu() {
    wx.showToast({ title: '菜单', icon: 'none' });
  },

  onQrCode() {
    wx.showToast({ title: '扫码功能开发中', icon: 'none' });
  },

  onMenuItem(e) {
    const { action } = e.currentTarget.dataset;
    const actions = {
      orders: '/pages/orders/orders',
      store: '/pages/store/store',
      member: '__toast__',
      points: '/pages/points/points',
      coupons: '/pages/coupons/coupons',
      address: '/pages/address/address',
      favorites: '/pages/favorites/favorites',
      shopOrders: '/pages/shop-orders/shop-orders',
      logistics: '/pages/shop-logistics/shop-logistics',
      settings: '/pages/settings/settings',
      about: '/pages/settings/settings',
      recharge: '/pages/recharge/recharge',
      claimcenter: '/pages/claim-center/claim-center',
      lucky: '/pages/lucky-wheel/lucky-wheel',
      service: '__toast__'
    };

    if (actions[action]) {
      if (actions[action] === '__toast__') {
        const messages = {
          service: '客服热线: 400-888-8888',
        };
        wx.showToast({ title: messages[action] || '功能开发中', icon: 'none', duration: 2000 });
        return;
      }
      const isTab = ['/pages/orders/orders'].includes(actions[action]);
      if (isTab) {
        wx.switchTab({ url: actions[action] });
      } else {
        wx.navigateTo({ url: actions[action] });
      }
    } else {
      wx.showToast({ title: '功能开发中', icon: 'none' });
    }
  },

  onGridSwiperChange(e) { this.setData({ gridPage: e.detail.current }); },

});
