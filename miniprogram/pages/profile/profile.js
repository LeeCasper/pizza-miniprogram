// pages/profile/profile.js
const app = getApp();

const TIERS = [
  {
    key: 'normal',
    name: '普通',
    gradient: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
    textColor: '#1f2937',
    progressTrackBg: 'rgba(0,0,0,0.1)',
    progressFillBg: 'rgba(0,0,0,0.5)',
    badgeBg: 'rgba(0,0,0,0.08)',
    threshold: 0
  },
  {
    key: 'gold',
    name: '黄金',
    gradient: 'linear-gradient(135deg, #fceabb 0%, #f8b500 100%)',
    textColor: '#451a03',
    progressTrackBg: 'rgba(120,53,15,0.12)',
    progressFillBg: 'rgba(120,53,15,0.7)',
    badgeBg: 'rgba(255,255,255,0.4)',
    threshold: 1000
  },
  {
    key: 'platinum',
    name: '铂金',
    gradient: 'linear-gradient(135deg, #e2e8f0 0%, #f8fafc 50%, #cbd5e1 100%)',
    textColor: '#1e293b',
    progressTrackBg: 'rgba(51,65,85,0.12)',
    progressFillBg: 'rgba(51,65,85,0.7)',
    badgeBg: 'rgba(255,255,255,0.5)',
    threshold: 3000
  },
  {
    key: 'diamond',
    name: '钻石',
    gradient: 'linear-gradient(135deg, #111827 0%, #000000 100%)',
    textColor: '#ffffff',
    progressTrackBg: 'rgba(255,255,255,0.2)',
    progressFillBg: 'rgba(255,255,255,0.9)',
    badgeBg: 'rgba(255,255,255,0.2)',
    threshold: 6000
  }
];
const TIER_THRESHOLDS = [0, 1000, 3000, 6000];
const ARC_LABELS = [
  { key: 'normal', label: '普通' },
  { key: 'gold', label: '圈内新人' },
  { key: 'platinum', label: '资深吃货' },
  { key: 'diamond', label: '至尊达人' }
];

function computeTier(points) {
  let tierIndex = 0;
  for (let i = TIER_THRESHOLDS.length - 1; i >= 0; i--) {
    if (points >= TIER_THRESHOLDS[i]) { tierIndex = i; break; }
  }
  const isMax = tierIndex >= TIERS.length - 1;
  const pointsToNext = isMax ? 0 : TIER_THRESHOLDS[tierIndex + 1] - points;
  let tierProgress = 100;
  if (!isMax) {
    const lo = TIER_THRESHOLDS[tierIndex];
    const hi = TIER_THRESHOLDS[tierIndex + 1];
    tierProgress = Math.round(((points - lo) / (hi - lo)) * 100);
  }
  return { tierIndex, pointsToNext, tierProgress, isMax };
}

function getArcOffset(index, activeIndex) {
  const dist = Math.abs(index - activeIndex);
  // Dots sit on the curve — farther from active = lower on the arc
  // Calculated for 1700rpx circle (radius 850rpx), labels ~171rpx apart
  if (dist === 0) return 0;
  if (dist === 1) return 22;
  if (dist === 2) return 76;
  return 177;
}

function getTrackShift(activeIndex, total) {
  // With space-around, label i is at (i+0.5)/total * 100% from left
  // Shift so active label sits at 50% (center)
  var pos = (activeIndex + 0.5) / total * 100;
  return Math.round(50 - pos);
}

function buildArcLabels(activeIndex) {
  return ARC_LABELS.map((item, i) => ({
    ...item,
    yOffset: getArcOffset(i, activeIndex)
  }));
}

function getCardSinkOffset(index, activeIndex) {
  const dist = Math.abs(index - activeIndex);
  if (dist === 0) return 0;
  if (dist === 1) return 24;
  if (dist === 2) return 56;
  return 100;
}

function buildTierCards(activeIndex) {
  return TIERS.map((t, i) => ({
    ...t,
    cardOffset: getCardSinkOffset(i, activeIndex)
  }));
}

Page({
  data: {
    statusBarHeight: 44,
    topBarTotalHeight: 80,
    userInfo: {},
    tierCards: buildTierCards(0),
    tierGrowthTexts: ['', '', '', ''],
    arcLabels: buildArcLabels(0),
    trackShift: 0,
    currentTierIndex: 0,
    userTierIndex: 0,
    pointsToNext: 0,
    tierProgress: 0,
    cardCount: 0,
    editProfileOpen: false,
    editForm: { name: '', bio: '', avatar: '' }
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
    const { tierIndex, pointsToNext, tierProgress, isMax } = computeTier(ui.points);

    // Precompute growth text for each tier card (WXML doesn't support string concat)
    const tierGrowthTexts = TIERS.map((t, i) => {
      if (i === tierIndex) {
        if (isMax) return '已达顶级';
        return '还需' + pointsToNext + '升级';
      } else if (i < tierIndex) {
        return '已达成';
      } else {
        const needed = TIER_THRESHOLDS[i] - ui.points;
        return '还需' + needed + '升级';
      }
    });

    this.setData({
      userInfo: {
        ...ui,
        memberLevel: TIERS[tierIndex].name,
        balanceText: '¥' + ui.balance.toFixed(2),
        cardCount: ui.cardCount || 0,
        bio: ui.bio || '享受美味每一天'
      },
      tierCards: buildTierCards(tierIndex),
      tierGrowthTexts,
      arcLabels: buildArcLabels(tierIndex),
      trackShift: getTrackShift(tierIndex, TIERS.length),
      currentTierIndex: tierIndex,
      userTierIndex: tierIndex,
      pointsToNext,
      tierProgress
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
          app.globalData.userInfo.avatar = avatarPath;
          that.loadUserData();
          wx.showToast({ title: '头像已更新', icon: 'success' });
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
    wx.showToast({ title: '保存成功', icon: 'success' });
  },

  // ========== 会员等级滑动 ==========
  onTierSwiperChange(e) {
    const idx = e.detail.current;
    this.setData({
      currentTierIndex: idx,
      tierCards: buildTierCards(idx),
      arcLabels: buildArcLabels(idx),
      trackShift: getTrackShift(idx, TIERS.length)
    });
  },

  onSelectTier(e) {
    const idx = e.currentTarget.dataset.index;
    if (idx === this.data.currentTierIndex) return;
    this.setData({
      currentTierIndex: idx,
      tierCards: buildTierCards(idx),
      arcLabels: buildArcLabels(idx),
      trackShift: getTrackShift(idx, TIERS.length)
    });
  },

  onCart() {
    wx.switchTab({ url: '/pages/index/index' });
  },

  onAnnounceTap() {
    wx.showToast({ title: '全新手工薄脆披萨上市，限时八折体验！', icon: 'none' });
  },

  onMenuItem(e) {
    const { action } = e.currentTarget.dataset;
    const actions = {
      orders: '/pages/orders/orders',
      store: '/pages/store/store',
      member: '/pages/member/member',
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
      const isTab = ['/pages/orders/orders', '/pages/member/member'].includes(actions[action]);
      if (isTab) {
        wx.switchTab({ url: actions[action] });
      } else {
        wx.navigateTo({ url: actions[action] });
      }
    } else {
      wx.showToast({ title: '功能开发中', icon: 'none' });
    }
  },

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
