// components/quick-login/quick-login.js — 微信快捷登录
const { api, doLogin, fixImageUrl, BASE_URL } = require('../../utils/api');
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
        // 每次打开重置头像/昵称状态
        this.setData({ avatarUrl: '', nickname: '', nicknameEditing: false });
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
    avatarUrl: '',        // chooseAvatar 临时路径
    nickname: '',         // 用户输入的昵称
    nicknameEditing: false, // 昵称编辑态（chip → input 切换）
  },

  methods: {
    // ── 协议勾选 ────────────────────────────

    onToggleAgree() {
      this.setData({ agreed: !this.data.agreed });
    },

    // ── 选择微信头像 ──────────────────────────

    onChooseAvatar(e) {
      const { avatarUrl } = e.detail;
      if (!avatarUrl) return;
      this.setData({ avatarUrl });
    },

    // ── 昵称输入 ─────────────────────────────

    onNicknameTap() {
      this.setData({ nicknameEditing: true });
    },

    onNicknameInput(e) {
      this.setData({ nickname: e.detail.value });
    },

    onNicknameBlur(e) {
      this.setData({ nickname: (e.detail.value || '').trim(), nicknameEditing: false });
    },

    // ── 上传头像到服务器（返回永久 URL） ─────

    _uploadAvatar(filePath) {
      return new Promise((resolve, reject) => {
        const token = wx.getStorageSync('token') || '';
        wx.uploadFile({
          url: BASE_URL + '/upload/avatar',
          filePath,
          name: 'file',
          header: { 'Authorization': 'Bearer ' + token },
          success(result) {
            if (result.statusCode === 200) {
              try {
                const data = JSON.parse(result.data);
                if (data.code === 0) {
                  resolve(fixImageUrl(data.data.url));
                  return;
                }
              } catch (_) {}
            }
            reject(new Error('上传失败'));
          },
          fail: reject,
        });
      });
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

      // 用户主动登录，清除退出标记
      wx.removeStorageSync('_loggedOut');
      if (app.globalData) app.globalData._loggedOut = false;

      const { avatarUrl, nickname } = this.data;

      // 构建请求体：有则有，无则后端随机默认
      const buildPayload = (permanentAvatarUrl) => {
        const payload = { code };
        if (permanentAvatarUrl) payload.avatar = permanentAvatarUrl;
        const name = (nickname || '').trim();
        if (name) payload.name = name;
        return payload;
      };

      // 选了头像就先上传到服务器，再绑定手机号；否则直接绑手机号
      const avatarPromise = avatarUrl
        ? this._uploadAvatar(avatarUrl).catch(() => null)
        : Promise.resolve(null);

      // 确保有 token（退出登录后快捷登录需要先静默登录获取 token）
      const ensureToken = wx.getStorageSync('token')
        ? Promise.resolve()
        : doLogin().then(() => {});

      Promise.all([avatarPromise, ensureToken]).then(([permanentAvatarUrl]) => {
        const payload = buildPayload(permanentAvatarUrl);
        return api.post('/auth/phone', payload);
      }).then(res => {
        wx.hideLoading();
        if (res.code === 0) {
          const { phone, avatar, name } = res.data;
          // 必须设置 phone（核心登录标识），avatar 和 name 可选
          if (phone) app.globalData.userInfo.phone = phone;
          if (avatar) app.globalData.userInfo.avatar = avatar;
          if (name) app.globalData.userInfo.name = name;
          wx.setStorageSync('userInfo', app.globalData.userInfo);
          wx.showToast({ title: '登录成功', icon: 'success' });
          // 重置组件状态，下次打开时干净
          this.setData({ animating: false, avatarUrl: '', nickname: '', nicknameEditing: false });
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
