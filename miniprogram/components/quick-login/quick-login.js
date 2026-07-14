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

      const { avatarUrl, nickname } = this.data;
      const name = (nickname || '').trim();
      console.log('[ql] onGetPhoneNumber — avatarUrl:', JSON.stringify(avatarUrl), 'nickname:', JSON.stringify(nickname), 'hasToken:', !!wx.getStorageSync('token'));

      if (!avatarUrl) {
        wx.showToast({ title: '请先选择微信头像', icon: 'none' });
        return;
      }
      if (!name) {
        wx.showToast({ title: '请先填写微信昵称', icon: 'none' });
        return;
      }

      wx.showLoading({ title: '登录中...' });

      // 用户主动登录，清除退出标记
      wx.removeStorageSync('_loggedOut');
      wx.removeStorageSync('_manualLogout');
      if (app.globalData) { app.globalData._loggedOut = false; app.globalData._manualLogout = false; }

      // 构建请求体：快捷登录必须携带本次选择的头像和昵称，避免后端保留旧值
      const buildPayload = (permanentAvatarUrl) => {
        return { code, avatar: permanentAvatarUrl, name };
      };

      // 确保有 token（必须先拿到 token，否则 _uploadAvatar 读不到）
      const ensureToken = wx.getStorageSync('token')
        ? Promise.resolve()
        : doLogin().then(() => {});

      // token 就绪后再上传头像 → 绑定手机号（串行，不能和 ensureToken 并行）
      ensureToken.then(() => {
        return this._uploadAvatar(avatarUrl).then(function(url) {
          console.log('[ql] upload SUCCESS — url:', JSON.stringify(url));
          return url;
        }).catch(function(err) {
          console.warn('[ql] upload FAILED —', err);
          wx.hideLoading();
          wx.showToast({ title: '头像上传失败，请重试', icon: 'none' });
          throw err;
        });
      }).then((permanentAvatarUrl) => {
        console.log('[ql] permanentAvatarUrl:', JSON.stringify(permanentAvatarUrl));
        const payload = buildPayload(permanentAvatarUrl);
        console.log('[ql] POST /auth/phone payload keys:', Object.keys(payload));
        return api.post('/auth/phone', payload);
      }).then(res => {
        console.log('[ql] /auth/phone response — code:', res && res.code, 'data:', JSON.stringify(res && res.data));
        wx.hideLoading();
        if (res.code === 0) {
          const { phone, avatar, name } = res.data;
          // 从 storage 合并 doLogin() 写入的完整用户对象，再覆盖新头像/昵称
          // 防止 logout 后 app.globalData.userInfo 是空 {} 导致残缺写入
          const stored = wx.getStorageSync('userInfo') || {};
          app.globalData.userInfo = { ...stored };
          if (phone) app.globalData.userInfo.phone = phone;
          if (avatar) app.globalData.userInfo.avatar = avatar;
          if (name) app.globalData.userInfo.name = name;
          wx.setStorageSync('userInfo', app.globalData.userInfo);
          console.log('[ql] globalData.userInfo final — avatar:', JSON.stringify(app.globalData.userInfo.avatar), 'name:', JSON.stringify(app.globalData.userInfo.name), 'phone:', JSON.stringify(app.globalData.userInfo.phone));
          wx.showToast({ title: '登录成功', icon: 'success' });
          // 重置组件状态，下次打开时干净
          this.setData({ animating: false, avatarUrl: '', nickname: '', nicknameEditing: false });
          // 传递组件刚写入的值给 onQuickLoginDone，防止 globalData 中途被覆盖
          setTimeout(() => this.triggerEvent('done', { avatar: app.globalData.userInfo.avatar, name: app.globalData.userInfo.name, phone: app.globalData.userInfo.phone }), 500);
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
      wx.navigateTo({ url: '/pages/content/content?type=agreement' });
    },

    onShowPrivacy() {
      wx.navigateTo({ url: '/pages/content/content?type=privacy' });
    },

    noop() {},
  },
});
