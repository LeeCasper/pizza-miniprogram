// pages/profile/profile.js
const { api } = require('../../utils/api');
const app = getApp();

// ── 会员等级（API 驱动 + 本地回退）─────────────
const FALLBACK_TIERS = [
  { levelKey: 'silver',    name: '银卡会员',   levelIndex: 1, minSpent:     0, discountRate: 1.00, pointsRewardRate: 1.00, birthdayGift: '生日当月享9折优惠一次',       couponValue:  0, accentColor: '#c0c0c0', bgStartColor: 'rgba(60,60,65,0.88)',  bgEndColor: 'rgba(25,25,30,0.95)', bgImage: '/images/tier-bg-silver.jpg' },
  { levelKey: 'gold',      name: '金卡会员',   levelIndex: 2, minSpent:   200, discountRate: 0.98, pointsRewardRate: 1.00, birthdayGift: '生日当月享8折优惠一次',       couponValue:  5, accentColor: '#f2ca50', bgStartColor: 'rgba(45,42,33,0.88)',  bgEndColor: 'rgba(17,14,7,0.95)', bgImage: '/images/tier-bg-gold.jpg' },
  { levelKey: 'rose_gold', name: '玫瑰金会员', levelIndex: 3, minSpent:  1000, discountRate: 0.95, pointsRewardRate: 1.20, birthdayGift: '生日当月享7折优惠+专属礼物',  couponValue: 10, accentColor: '#e0a2a2', bgStartColor: 'rgba(50,35,35,0.88)',  bgEndColor: 'rgba(20,15,15,0.95)', bgImage: '/images/tier-bg-rosegold.jpg' },
  { levelKey: 'platinum',  name: '铂金会员',   levelIndex: 4, minSpent:  3000, discountRate: 0.90, pointsRewardRate: 1.50, birthdayGift: '生日当月享6折优惠+上门配送',  couponValue: 20, accentColor: '#b4bed2', bgStartColor: 'rgba(35,40,50,0.88)',  bgEndColor: 'rgba(15,17,25,0.95)', bgImage: '/images/tier-bg-platinum.jpg' },
  { levelKey: 'diamond',   name: '钻石会员',   levelIndex: 5, minSpent: 10000, discountRate: 0.85, pointsRewardRate: 2.00, birthdayGift: '生日当月享5折优惠+专属客服',  couponValue: 50, accentColor: '#82c8f0', bgStartColor: 'rgba(20,35,50,0.88)',  bgEndColor: 'rgba(10,15,25,0.95)', bgImage: '/images/tier-bg-diamond.jpg' },
];

function computeTier(totalSpent, tiers) {
  let current = tiers[0], next = tiers[1];
  for (let i = tiers.length - 1; i >= 0; i--) {
    if (totalSpent >= tiers[i].minSpent) { current = tiers[i]; next = tiers[i + 1] || null; break; }
  }
  return { current, next };
}

function buildTierCards(apiTiers, userTier) {
  return apiTiers.map(t => {
    const isActive = t.levelKey === userTier.current.levelKey;
    let progressText = '', actionText = '';
    if (t.levelIndex < userTier.current.levelIndex) {
      progressText = '已达成';
      actionText = t.discountRate < 1 ? '享' + ((1 - t.discountRate) * 100).toFixed(0) + '%折扣' : '查看特权';
    } else if (isActive) {
      if (userTier.next) {
        const diff = (userTier.next.minSpent - (userTier._totalSpent || 0)).toFixed(2);
        progressText = '还差¥' + diff + '升级' + userTier.next.name;
        actionText = '查看权益';
      } else {
        progressText = '已达最高等级';
        actionText = '尊享特权';
      }
    } else {
      const diff = (t.minSpent - (userTier._totalSpent || 0)).toFixed(2);
      progressText = '消费满¥' + t.minSpent + '解锁';
      actionText = '查看权益';
    }
    const discountText = t.discountRate < 1 ? ((1 - t.discountRate) * 100).toFixed(0) + '折' : '';
    const bgStyle = t.bgImage ? 'background-image:url(' + t.bgImage + ');background-size:cover;background-position:center;' : '';
    return {
      levelKey: t.levelKey, levelIndex: t.levelIndex, name: t.name,
      accentColor: t.accentColor, bgStartColor: t.bgStartColor, bgEndColor: t.bgEndColor,
      bgImage: t.bgImage || null, bgStyle,
      discountRate: t.discountRate, pointsRewardRate: t.pointsRewardRate,
      birthdayGift: t.birthdayGift,
      discountText,
      isActive, progressText, actionText,
    };
  });
}

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
    const sh = app.globalData.statusBarHeight;
    this.setData({
      statusBarHeight: sh,
      topBarTotalHeight: sh + 36
    });
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
    const ui = app.globalData.userInfo;
    const totalSpent = ui.totalSpent || 0;

    this._ensureTiersLoaded().then(apiTiers => {
      const tierInfo = computeTier(totalSpent, apiTiers);
      tierInfo._totalSpent = totalSpent;
      const tierCards = buildTierCards(apiTiers, tierInfo);
      const activeTierIndex = tierInfo.current.levelIndex - 1;

      this.setData({
        userInfo: {
          ...ui,
          balanceText: '¥' + ((ui.balance || 0)).toFixed(2),
          cardCount: ui.cardCount || 0,
          bio: ui.bio || '享受美味每一天'
        },
        tierCards,
        activeTierIndex,
      });
    });

    // 后台刷新用户数据
    api.get('/user/profile').then(res => {
      if (res.code === 0) {
        app.globalData.userInfo = res.data;
        wx.setStorageSync('userInfo', res.data);
        const ui = res.data;
        this.setData({
          userInfo: { ...ui, balanceText: '¥' + ((ui.balance || 0)).toFixed(2), cardCount: ui.cardCount || 0, bio: ui.bio || '享受美味每一天' }
        });
      }
    }).catch(() => {});
  },

  _ensureTiersLoaded() {
    if (this._apiTiers) return Promise.resolve(this._apiTiers);
    return api.get('/user/member-tiers').then(res => {
      this._apiTiers = (res && res.code === 0 && res.data && res.data.length) ? res.data : FALLBACK_TIERS;
      return this._apiTiers;
    }).catch(() => {
      this._apiTiers = FALLBACK_TIERS;
      return this._apiTiers;
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

});
