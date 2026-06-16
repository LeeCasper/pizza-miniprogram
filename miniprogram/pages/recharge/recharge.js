// pages/recharge/recharge.js
const { api } = require('../../utils/api');
const pay = require('../../utils/pay');
const app = getApp();

const PRESET_AMOUNTS = [50, 100, 200, 300, 500, 1000];

Page({
  data: {
    statusBarHeight: 44,
    topBarTotalHeight: 80,
    balance: 0,
    balanceText: '¥0.00',
    presetAmounts: PRESET_AMOUNTS,
    selectedAmount: 0,
    customAmount: '',
    customMode: false,
  },

  onLoad() {
    const sh = app.globalData.statusBarHeight || 44;
    this.setData({
      statusBarHeight: sh,
      topBarTotalHeight: sh + 36,
    });
    this.loadBalance();
  },

  onShow() {
    this.loadBalance();
  },

  loadBalance() {
    const ui = app.globalData.userInfo || {};
    const balance = parseFloat(ui.balance || 0);
    this.setData({
      balance,
      balanceText: '¥' + balance.toFixed(2),
    });
  },

  onSelectAmount(e) {
    const amt = e.currentTarget.dataset.amount;
    this.setData({
      selectedAmount: amt,
      customAmount: '',
      customMode: false,
    });
  },

  onCustomTap() {
    this.setData({
      customMode: true,
      selectedAmount: 0,
    });
  },

  onCustomInput(e) {
    let val = e.detail.value;
    // Allow only numbers with up to 2 decimals
    val = val.replace(/[^\d.]/g, '');
    const parts = val.split('.');
    if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
    if (parts[1] && parts[1].length > 2) val = parts[0] + '.' + parts[1].slice(0, 2);
    this.setData({ customAmount: val });
  },

  getRechargeAmount() {
    if (this.data.customMode) {
      const amt = parseFloat(this.data.customAmount);
      return (amt > 0 && amt <= 5000) ? amt : 0;
    }
    return this.data.selectedAmount;
  },

  onRecharge() {
    const amount = this.getRechargeAmount();
    if (!amount) {
      wx.showToast({ title: '请选择或输入充值金额', icon: 'none' });
      return;
    }
    if (amount > 5000) {
      wx.showToast({ title: '单次充值上限¥5000', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '确认充值',
      content: '充值 ¥' + amount.toFixed(2) + ' 到账户余额？',
      success: (res) => {
        if (res.confirm) {
          this.doRecharge(amount);
        }
      },
    });
  },

  doRecharge(amount) {
    pay.rechargeBalance(amount).then(() => {
      // Refresh balance from server (payment callback may have already updated it)
      api.get('/user/profile').then(res => {
        if (res.code === 0) {
          app.globalData.userInfo = res.data;
          wx.setStorageSync('userInfo', res.data);
          this.loadBalance();
        } else {
          // Fallback: update locally
          app.globalData.userInfo.balance = (app.globalData.userInfo.balance || 0) + amount;
          wx.setStorageSync('userInfo', app.globalData.userInfo);
          this.loadBalance();
        }
      }).catch(() => {
        // If network fails, update locally
        app.globalData.userInfo.balance = (app.globalData.userInfo.balance || 0) + amount;
        wx.setStorageSync('userInfo', app.globalData.userInfo);
        this.loadBalance();
      });
    }).catch((err) => {
      if (!err.cancelled) {
        wx.showToast({ title: '充值失败，请重试', icon: 'none' });
      }
    });
  },

  onBack() {
    wx.navigateBack();
  },

  noop() {},
});
