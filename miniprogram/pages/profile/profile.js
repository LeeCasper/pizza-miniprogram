// pages/profile/profile.js
const { api } = require('../../utils/api');
const { computeTier, buildTierCards, loadTiers } = require('../../utils/tiers');
const { getSimpleTopBar } = require('../../utils/layout');
const { logout } = require('../../utils/auth');
const app = getApp();

Page({
  data: {
    statusBarHeight: 44,
    topBarTotalHeight: 80,
    userInfo: {},
    cardCount: 0,
    editProfileOpen: false,
    editForm: { name: '', bio: '', avatar: '' },
    announceOpen: false,
    tierCards: [],
    activeTierIndex: 0,
  },

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
    const cachedUi = app.globalData.userInfo;
    // 立即显示缓存的用户基本信息
    this.setData({
      userInfo: { ...cachedUi, balanceText: '¥' + ((cachedUi.balance || 0)).toFixed(2), cardCount: cachedUi.cardCount || 0, bio: cachedUi.bio || '享受美味每一天' },
    });

    // 并行获取最新用户数据 & 等级配置，只构建一次卡片（避免 swiper 连续两次 setData 导致抖动）
    Promise.all([
      api.get('/user/profile').then(res => res.code === 0 ? res.data : null).catch(() => null),
      loadTiers(),
    ]).then(([freshUi, apiTiers]) => {
      let ui = cachedUi;
      if (freshUi) {
        app.globalData.userInfo = freshUi;
        wx.setStorageSync('userInfo', freshUi);
        ui = freshUi;
      }
      // 等级判定使用 余额+消费金额 作为资格金额（与后端逻辑一致）
      const qualifyingAmount = (ui.totalSpent || 0) + (ui.balance || 0);
      const tierInfo = computeTier(qualifyingAmount, apiTiers, ui.memberLevel);
      tierInfo._totalSpent = qualifyingAmount;
      const tierCards = buildTierCards(apiTiers, tierInfo);
      const activeTierIndex = tierInfo.current.levelIndex - 1;
      this.setData({
        userInfo: { ...ui, balanceText: '¥' + ((ui.balance || 0)).toFixed(2), cardCount: ui.cardCount || 0, bio: ui.bio || '享受美味每一天' },
        tierCards,
        activeTierIndex,
      });
    });
  },

  onMenu() {
    wx.showToast({ title: '菜单', icon: 'none' });
  },

  onQrCode() {
    wx.showToast({ title: '扫码功能开发中', icon: 'none' });
  },

  // ========== 头像 ==========
  onChooseAvatar() {
    const that = this;
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success(res) {
        const avatarPath = res.tempFilePaths[0];
        if (that.data.editProfileOpen) {
          that.setData({ 'editForm.avatar': avatarPath });
        } else {
          // Upload to server
          wx.showLoading({ title: '上传中...' });
          wx.uploadFile({
            url: 'https://artaides.com/api/v1/upload/avatar',
            filePath: avatarPath,
            name: 'file',
            header: {
              'Authorization': 'Bearer ' + (wx.getStorageSync('token') || ''),
            },
            success(result) {
              wx.hideLoading();
              if (result.statusCode === 200) {
                const data = JSON.parse(result.data);
                if (data.code === 0) {
                  app.globalData.userInfo.avatar = data.data.url;
                  that.loadUserData();
                  wx.showToast({ title: '头像已更新', icon: 'success' });
                }
              } else {
                // Fallback: keep local path
                app.globalData.userInfo.avatar = avatarPath;
                that.loadUserData();
                wx.showToast({ title: '头像已更新', icon: 'success' });
              }
            },
            fail() {
              wx.hideLoading();
              // Fallback: local only
              app.globalData.userInfo.avatar = avatarPath;
              that.loadUserData();
              wx.showToast({ title: '头像已更新（本地）', icon: 'success' });
            },
          });
        }
      }
    });
  },

  // ========== 编辑个人信息 ==========
  onOpenEditProfile() {
    const ui = this.data.userInfo;
    this.setData({
      editProfileOpen: true,
      editForm: {
        name: ui.name || '',
        bio: ui.bio || '',
        avatar: ui.avatar || ''
      }
    });
  },

  onCloseEditProfile() {
    this.setData({ editProfileOpen: false });
  },

  onNameInput(e) {
    this.setData({ 'editForm.name': e.detail.value });
  },

  onBioInput(e) {
    this.setData({ 'editForm.bio': e.detail.value });
  },

  onSaveProfile() {
    const { editForm } = this.data;
    if (!editForm.name.trim()) {
      wx.showToast({ title: '请输入昵称', icon: 'none' });
      return;
    }
    const ui = app.globalData.userInfo;
    ui.name = editForm.name.trim();
    ui.bio = editForm.bio.trim();
    if (editForm.avatar) {
      ui.avatar = editForm.avatar;
    }
    this.setData({ editProfileOpen: false });
    this.loadUserData();

    // Sync to server
    api.put('/user/profile', {
      name: ui.name,
      bio: ui.bio,
    }).then(() => {
      wx.showToast({ title: '保存成功', icon: 'success' });
    }).catch(() => {
      wx.showToast({ title: '保存成功（本地）', icon: 'success' });
    });
  },

  // ── 会员卡轮播 ──────────────────────────────
  onTierChange(e) {
    const idx = e.detail.current;
    const tierCards = this.data.tierCards.map((card, i) => {
      card.isActive = i === idx;
      return card;
    });
    this.setData({ activeTierIndex: idx, tierCards });
  },

  onUpgradeTier(e) {
    const levelKey = e.currentTarget.dataset.levelKey;
    wx.navigateTo({ url: '/pages/tiers/tiers?levelKey=' + levelKey });
  },

  // ── 公告浮窗 ──────────────────────────────
  onAnnounceToggle() {
    const open = !this.data.announceOpen;
    this.setData({ announceOpen: open });
    if (this._announceTimer) clearTimeout(this._announceTimer);
    if (open) {
      this._announceTimer = setTimeout(() => {
        this.setData({ announceOpen: false });
      }, 8000);
    }
  },
  onAnnounceClose() {
    this.setData({ announceOpen: false });
    if (this._announceTimer) clearTimeout(this._announceTimer);
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
      favorites: '/pages/address/address',
      settings: '/pages/settings/settings',
      about: '/pages/settings/settings',
      recharge: '/pages/recharge/recharge',
      lucky: '__toast__',
      service: '__toast__'
    };

    if (actions[action]) {
      if (actions[action] === '__toast__') {
        const messages = {
          lucky: '幸运转盘即将上线，敬请期待！',
          service: '客服热线: 400-888-8888'
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

  noop() {},

  onLogout() {
    logout();
  },

});
