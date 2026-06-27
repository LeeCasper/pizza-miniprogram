// components/quick-login/quick-login.js — 微信快捷登录
const { api, fixImageUrl, BASE_URL } = require('../../utils/api');
const app = getApp();

Component({
  properties: {
    visible: {
      type: Boolean,
      value: false,
    },
  },

  observers: {
    'visible'(val) {
      if (val) {
        // 延迟一帧触发动画
        setTimeout(() => this.setData({ animating: true }), 50);
      } else {
        this.setData({ animating: false });
      }
    },
  },

  lifetimes: {
    attached() {
      const sys = wx.getSystemInfoSync();
      this.setData({ statusBarHeight: sys.statusBarHeight });
    },
  },

  data: {
    animating: false,
    statusBarHeight: 44,
    agreed: true,         // 协议默认勾选
  },

  methods: {
    // ── 协议勾选 ────────────────────────────

    onToggleAgree() {
      this.setData({ agreed: !this.data.agreed });
    },

    // ── 微信一键登录（获取手机号） ──────────

    onGetPhoneNumber(e) {
      if (!this.data.agreed) {
        wx.showToast({ title: '请先阅读并同意用户协议', icon: 'none' });
        return;
      }
      const { code, errMsg } = e.detail;
      if (!code) {
        // 用户拒绝授权不提示
        if (errMsg && errMsg.indexOf('deny') === -1) {
          wx.showToast({ title: '获取失败，请重试', icon: 'none' });
        }
        return;
      }
      wx.showLoading({ title: '登录中...' });
      api.post('/auth/phone', { code }).then(res => {
        wx.hideLoading();
        if (res.code === 0) {
          const { phone, avatar, name } = res.data;
          // 必须设置 phone（核心登录标识），avatar 和 name 可选
          if (phone) app.globalData.userInfo.phone = phone;
          if (avatar) app.globalData.userInfo.avatar = avatar;
          if (name) app.globalData.userInfo.name = name;
          wx.setStorageSync('userInfo', app.globalData.userInfo);
          wx.showToast({ title: '登录成功', icon: 'success' });
          // 直接完成登录，不再需要完善信息步骤
          this.setData({ animating: false });
          setTimeout(() => this.triggerEvent('done'), 500);
        } else {
          wx.showToast({ title: res.message || '登录失败', icon: 'none' });
        }
      }).catch(() => {
        wx.hideLoading();
        wx.showToast({ title: '网络异常，请重试', icon: 'none' });
      });
    },

    // ── 完成 / 跳过 ──────────────────────────

    onSkip() {
      this.setData({ animating: false });
      setTimeout(() => this.triggerEvent('skip'), 300);
    },

    // ── 协议链接 ────────────────────────────

    onShowTerms() {
      wx.showToast({ title: '用户协议', icon: 'none' });
    },

    onShowPrivacy() {
      wx.showToast({ title: '隐私政策', icon: 'none' });
    },

    noop() {},
  },
});
