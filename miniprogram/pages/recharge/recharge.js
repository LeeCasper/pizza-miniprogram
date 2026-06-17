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
    // Show cached balance immediately, then refresh from API
    const cached = app.globalData.userInfo || {};
    const cachedBalance = parseFloat(cached.balance || 0);
    this.setData({
      balance: cachedBalance,
      balanceText: '¥' + cachedBalance.toFixed(2),
    });

    // Always fetch latest from server — prevents stale globalData
    // from other pages overwriting the optimistic update
    api.get('/user/profile').then(res => {
      if (res.code === 0 && res.data) {
        app.globalData.userInfo = res.data;
        wx.setStorageSync('userInfo', res.data);
        const freshBalance = parseFloat(res.data.balance || 0);
        this.setData({
          balance: freshBalance,
          balanceText: '¥' + freshBalance.toFixed(2),
        });
      }
    }).catch(() => {
      // Keep cached value — no-op
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
    const oldBalance = parseFloat(app.globalData.userInfo.balance || 0);

    // Optimistic update: show expected balance immediately + growth progress
    const optimisticBalance = oldBalance + amount;
    app.globalData.userInfo.balance = optimisticBalance;
    app.globalData.userInfo.total_spent = (app.globalData.userInfo.total_spent || 0) + amount;
    this.loadBalance();

    pay.rechargeBalance(amount).then((result) => {
      // If server confirmed the payment, refresh once; otherwise use retry
      if (result && result.status === 'success') {
        // Server confirmed — single refresh is enough
        this._refreshBalanceOnce(oldBalance);
      } else {
        // Polling didn't confirm (callback may be delayed) — use retry
        console.log('[recharge] Server not yet confirmed, using retry refresh');
        this._refreshBalanceAfterRecharge(oldBalance, amount, 0);
      }
    }).catch((err) => {
      if (!err.cancelled) {
        // Restore old balance on failure
        app.globalData.userInfo.balance = oldBalance;
        this.loadBalance();
        wx.showToast({ title: '充值失败，请重试', icon: 'none' });
      } else {
        // User cancelled — restore old balance
        app.globalData.userInfo.balance = oldBalance;
        this.loadBalance();
      }
    });
  },

  /**
   * Single balance refresh (no retry) — used when server has confirmed payment.
   */
  _refreshBalanceOnce(oldBalance) {
    setTimeout(() => {
      api.get('/user/profile').then(res => {
        if (res.code === 0 && res.data) {
          app.globalData.userInfo = res.data;
          wx.setStorageSync('userInfo', res.data);
          this.loadBalance();
        }
      }).catch(() => {
        // Fallback: keep optimistic value
      });
    }, 1000);
  },

  /**
   * Refresh balance from server after recharge, with retry.
   * The WeChat callback may take a few seconds to arrive, so we
   * retry if balance hasn't changed from the old value.
   *
   * @param {number} oldBalance - balance before recharge
   * @param {number} amount - recharge amount
   * @param {number} attempt - current retry count
   */
  _refreshBalanceAfterRecharge(oldBalance, amount, attempt) {
    const delay = attempt === 0 ? 1500 : 2000;

    setTimeout(() => {
      api.get('/user/profile').then(res => {
        if (res.code === 0 && res.data) {
          const newBalance = parseFloat(res.data.balance || 0);
          app.globalData.userInfo = res.data;
          wx.setStorageSync('userInfo', res.data);
          this.loadBalance();

          // If balance still hasn't changed and we have retries left, try again
          if (newBalance <= oldBalance && attempt < 2) {
            console.log('[recharge] Balance not yet updated, retrying...', attempt + 1);
            this._refreshBalanceAfterRecharge(oldBalance, amount, attempt + 1);
          } else if (newBalance <= oldBalance) {
            // All retries exhausted — keep optimistic update as fallback
            console.warn('[recharge] Balance sync failed after retries, using optimistic value');
            app.globalData.userInfo.balance = oldBalance + amount;
            wx.setStorageSync('userInfo', app.globalData.userInfo);
            this.loadBalance();
          }
        } else if (attempt < 2) {
          this._refreshBalanceAfterRecharge(oldBalance, amount, attempt + 1);
        }
        // If all retries exhausted and API failed, optimistic value remains
      }).catch(() => {
        if (attempt < 2) {
          this._refreshBalanceAfterRecharge(oldBalance, amount, attempt + 1);
        }
        // On final failure, optimistic value remains
      });
    }, delay);
  },

  onBack() {
    wx.navigateBack();
  },

  noop() {},
});
