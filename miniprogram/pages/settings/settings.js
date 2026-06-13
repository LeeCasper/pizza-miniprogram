// pages/settings/settings.js
const app = getApp();

Page({
  data: {
    statusBarHeight: 44,
    topBarTotalHeight: 80,
    notificationEnabled: true,
    cacheSize: '',
    // 抽屉
    drawerOpen: false,
    drawerType: '',    // 'account' | 'about' | 'agreement' | 'privacy'
    drawerTitle: '',
    // 账号安全
    phoneNumber: '',
    editPhone: '',
    editPhoneOpen: false
  },

  onLoad() {
    const sh = app.globalData.statusBarHeight;
    const sys = wx.getSystemInfoSync();
    const rpx = sys.windowWidth / 750;
    const topBarH = sh + 80 * rpx + 24 * rpx;

    // 估算缓存大小
    let cacheSize = '0 KB';
    try {
      const info = wx.getStorageInfoSync();
      const kb = Math.round(info.currentSize);
      if (kb < 1024) {
        cacheSize = kb + ' KB';
      } else {
        cacheSize = (kb / 1024).toFixed(1) + ' MB';
      }
    } catch (e) {
      cacheSize = '--';
    }

    this.setData({
      statusBarHeight: sh,
      topBarTotalHeight: topBarH,
      notificationEnabled: app.globalData.notificationEnabled !== false,
      cacheSize,
      phoneNumber: app.globalData.settingsPhone || '138****8888'
    });
  },

  onBack() {
    if (this.data.drawerOpen) {
      this.onCloseDrawer();
    } else {
      wx.navigateBack();
    }
  },

  // ========== 通知设置 ==========
  onToggleNotification(e) {
    const val = e.detail.value;
    app.globalData.notificationEnabled = val;
    this.setData({ notificationEnabled: val });
    wx.showToast({ title: val ? '已开启通知' : '已关闭通知', icon: 'none', duration: 1200 });
  },

  // ========== 清除缓存 ==========
  onClearCache() {
    wx.showModal({
      title: '清除缓存',
      content: '确定要清除所有本地缓存数据吗？',
      success: (res) => {
        if (res.confirm) {
          try {
            wx.clearStorageSync();
          } catch (e) {
            // 忽略清理错误
          }
          this.setData({ cacheSize: '0 KB' });
          wx.showToast({ title: '缓存已清除', icon: 'success' });
        }
      }
    });
  },

  // ========== 退出登录 ==========
  onLogout() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          wx.showToast({ title: '已退出', icon: 'success' });
        }
      }
    });
  },

  // ========== 抽屉管理 ==========
  onOpenDrawer(e) {
    const { type } = e.currentTarget.dataset;
    let title = '';
    switch (type) {
      case 'account': title = '账号安全'; break;
      case 'about': title = '关于我们'; break;
      case 'agreement': title = '用户协议'; break;
      case 'privacy': title = '隐私政策'; break;
    }
    this.setData({
      drawerOpen: true,
      drawerType: type,
      drawerTitle: title,
      editPhone: this.data.phoneNumber,
      editPhoneOpen: false
    });
  },

  onCloseDrawer() {
    this.setData({ drawerOpen: false, drawerType: '', editPhoneOpen: false });
  },

  // ========== 账号安全 ==========
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
    // 保存到 globalData
    app.globalData.settingsPhone = phone;
    this.setData({ phoneNumber: phone, editPhoneOpen: false });
    wx.showToast({ title: '手机号已更新', icon: 'success' });
  },

  onCancelEditPhone() {
    this.setData({ editPhoneOpen: false, editPhone: this.data.phoneNumber });
  },

  noop() {}
});
