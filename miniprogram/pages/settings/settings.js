// pages/settings/settings.js
const { api } = require('../../utils/api');
const app = getApp();

Page({
  data: {
    statusBarHeight: 44,
    topBarTotalHeight: 80,
    notificationEnabled: true,
    cacheSize: '',
    drawerOpen: false,
    drawerType: '',
    drawerTitle: '',
    phoneNumber: '',
    editPhone: '',
    editPhoneOpen: false,
  },

  onLoad() {
    const sh = app.globalData.statusBarHeight;
    const sys = wx.getSystemInfoSync();
    const rpx = sys.windowWidth / 750;
    const topBarH = sh + 80 * rpx + 24 * rpx;

    let cacheSize = '0 KB';
    try {
      const info = wx.getStorageInfoSync();
      const kb = Math.round(info.currentSize);
      cacheSize = kb < 1024 ? kb + ' KB' : (kb / 1024).toFixed(1) + ' MB';
    } catch (e) { /* ignore */ }

    this.setData({
      statusBarHeight: sh,
      topBarTotalHeight: topBarH,
      notificationEnabled: app.globalData.notificationEnabled !== false,
      cacheSize,
    });

    // Load settings from API
    api.get('/user/settings').then(res => {
      if (res.code === 0) {
        this.setData({
          notificationEnabled: res.data.notificationEnabled !== false,
          phoneNumber: res.data.phone || '未设置',
        });
      }
    }).catch(() => {});
  },

  onBack() {
    if (this.data.drawerOpen) {
      this.onCloseDrawer();
    } else {
      wx.navigateBack();
    }
  },

  onToggleNotification(e) {
    const val = e.detail.value;
    app.globalData.notificationEnabled = val;
    this.setData({ notificationEnabled: val });
    api.put('/user/settings', { notificationEnabled: val }).catch(() => {});
    wx.showToast({ title: val ? '已开启通知' : '已关闭通知', icon: 'none', duration: 1200 });
  },

  onClearCache() {
    wx.showModal({
      title: '清除缓存',
      content: '确定要清除所有本地缓存数据吗？',
      success: (res) => {
        if (res.confirm) {
          try { wx.clearStorageSync(); } catch (e) {}
          this.setData({ cacheSize: '0 KB' });
          wx.showToast({ title: '缓存已清除', icon: 'success' });
        }
      }
    });
  },

  onLogout() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          // Clear token
          wx.removeStorageSync('token');
          wx.removeStorageSync('userInfo');
          wx.showToast({ title: '已退出', icon: 'success' });
        }
      }
    });
  },

  onOpenDrawer(e) {
    const { type } = e.currentTarget.dataset;
    const titles = {
      account: '账号安全',
      about: '关于我们',
      agreement: '用户协议',
      privacy: '隐私政策',
    };
    this.setData({
      drawerOpen: true,
      drawerType: type,
      drawerTitle: titles[type] || '',
      editPhone: this.data.phoneNumber,
      editPhoneOpen: false,
    });
  },

  onCloseDrawer() {
    this.setData({ drawerOpen: false, drawerType: '', editPhoneOpen: false });
  },

  onEditPhone() {
    this.setData({ editPhoneOpen: true });
  },

  onPhoneInput(e) {
    this.setData({ editPhone: e.detail.value });
  },

  onSavePhone() {
    const phone = this.data.editPhone.trim();
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      wx.showToast({ title: '请输入正确的11位手机号', icon: 'none' });
      return;
    }
    api.put('/user/settings', { phone }).then(res => {
      if (res.code === 0) {
        this.setData({ phoneNumber: phone, editPhoneOpen: false });
        wx.showToast({ title: '手机号已更新', icon: 'success' });
      }
    }).catch(() => {
      wx.showToast({ title: '更新失败', icon: 'none' });
    });
  },

  onCancelEditPhone() {
    this.setData({ editPhoneOpen: false, editPhone: this.data.phoneNumber });
  },

  noop() {}
});
