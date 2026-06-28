// pages/settings/settings.js
const { api } = require('../../utils/api');
const { getBackBtnTopBar } = require('../../utils/layout');
const { logout } = require('../../utils/auth');
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
    let cacheSize = '0 KB';
    try {
      const info = wx.getStorageInfoSync();
      const kb = Math.round(info.currentSize);
      cacheSize = kb < 1024 ? kb + ' KB' : (kb / 1024).toFixed(1) + ' MB';
    } catch (e) { /* ignore */ }

    this.setData({
      ...getBackBtnTopBar(),
      notificationEnabled: app.globalData.notificationEnabled !== false,
      cacheSize,
    });

    // Load settings from API
    if (wx.getStorageSync('_manualLogout')) {
      this.setData({ phoneNumber: '未设置' });
      return;
    }
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
    logout().then(confirmed => {
      if (confirmed) {
        setTimeout(() => wx.navigateBack(), 800);
      }
    });
  },

  onDeleteAccount() {
    wx.showModal({
      title: '确认注销账号',
      content: '注销后将删除您的个人信息、清零余额和积分，且无法恢复。',
      confirmText: '继续注销',
      confirmColor: '#C0563A',
      success: (res) => {
        if (!res.confirm) return;
        // 二次确认
        wx.showModal({
          title: '再次确认',
          content: '此操作不可撤销，确定要注销账号吗？',
          confirmText: '确定注销',
          confirmColor: '#C0563A',
          success: (res2) => {
            if (!res2.confirm) return;
            wx.showLoading({ title: '处理中...' });
            api.delete('/user/account').then(res3 => {
              wx.hideLoading();
              if (res3.code === 0) {
                wx.clearStorageSync();
                const app = getApp();
                if (app && app.globalData) {
                  app.globalData.userInfo = {};
                  app.globalData.token = '';
                }
                wx.showToast({ title: '账号已注销', icon: 'success', duration: 1500 });
                setTimeout(() => {
                  wx.reLaunch({ url: '/pages/main/main' });
                }, 1500);
              } else {
                wx.showToast({ title: res3.message || '注销失败', icon: 'none' });
              }
            }).catch(err => {
              wx.hideLoading();
              const msg = (err && err.message) || '注销失败，请稍后重试';
              wx.showToast({ title: msg.includes('订单') ? '请先完成或取消进行中的订单' : msg, icon: 'none', duration: 2500 });
            });
          }
        });
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
