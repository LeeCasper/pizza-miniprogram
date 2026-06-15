// pages/profile/profile.js
const { api } = require('../../utils/api');
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
    currentTierIndex: 0,
    userTierIndex: 0,
    pointsToNext: 0,
    tierProgress: 0,
    cardCount: 0,
    editProfileOpen: false,
    editForm: { name: '', bio: '', avatar: '' },
    announceOpen: false,
    memberOverlayOpen: false,
    selectedPlan: 'monthly',
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
    const { tierIndex, pointsToNext, tierProgress, isMax } = computeTier(ui.points || 0);

    // Precompute growth text for each tier card
    const tierGrowthTexts = TIERS.map((t, i) => {
      if (i === tierIndex) {
        if (isMax) return '已达顶级';
        return '还需' + pointsToNext + '升级';
      } else if (i < tierIndex) {
        return '已达成';
      } else {
        const needed = TIER_THRESHOLDS[i] - (ui.points || 0);
        return '还需' + needed + '升级';
      }
    });

    this.setData({
      userInfo: {
        ...ui,
        memberLevel: TIERS[tierIndex].name,
        balanceText: '¥' + ((ui.balance || 0)).toFixed(2),
        cardCount: ui.cardCount || 0,
        bio: ui.bio || '享受美味每一天'
      },
      tierCards: buildTierCards(tierIndex),
      tierGrowthTexts,
      currentTierIndex: tierIndex,
      userTierIndex: tierIndex,
      pointsToNext,
      tierProgress
    });

    // 后台刷新用户数据
    api.get('/user/profile').then(res => {
      if (res.code === 0) {
        app.globalData.userInfo = res.data;
        wx.setStorageSync('userInfo', res.data);
        this.loadUserData();
      }
    }).catch(() => {});
  },

  onMenu() {
    wx.showToast({ title: '菜单', icon: 'none' });
  },

  onQrCode() {
    wx.showToast({ title: '扫码功能开发中', icon: 'none' });
  },

  onActivateMember() {
    this.setData({ memberOverlayOpen: true });
  },

  onMemberOverlayClose() {
    this.setData({ memberOverlayOpen: false });
  },

  onSelectPlan(e) {
    const { plan } = e.currentTarget.dataset;
    this.setData({ selectedPlan: plan });
  },

  onMemberSubscribe() {
    const plan = this.data.selectedPlan;
    const planNames = { annual: '连续包年 ¥199', monthly: '连续包月 ¥19.9' };
    wx.showModal({
      title: '开通会员',
      content: '确认开通' + (planNames[plan] || '会员') + '？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '开通中...' });
          api.post('/member/subscribe', { plan }).then(result => {
            wx.hideLoading();
            if (result.code === 0) {
              wx.showToast({ title: '开通成功！', icon: 'success' });
              this.setData({ memberOverlayOpen: false });
              this.loadUserData();
            } else {
              wx.showToast({ title: result.message || '开通失败', icon: 'none' });
            }
          }).catch(() => {
            wx.hideLoading();
            wx.showToast({ title: '开通失败，请重试', icon: 'none' });
          });
        }
      }
    });
  },

  onMemberHelp() {
    wx.showToast({ title: '优惠券每周一自动发放至您的账户', icon: 'none', duration: 2000 });
  },

  onMemberTerms() {
    wx.showToast({ title: '会员使用条款', icon: 'none' });
  },

  onMemberPrivacy() {
    wx.showToast({ title: '隐私政策', icon: 'none' });
  },

  onMemberRestore() {
    wx.showToast({ title: '正在恢复购买...', icon: 'none' });
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
            url: 'https://www.artaides.com/api/v1/upload/avatar',
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

  // ========== 会员等级滑动 ==========
  // 动画结束后更新卡片下沉效果
  onTierSwiperAnimDone(e) {
    const idx = e.detail.current;
    this.setData({ tierCards: buildTierCards(idx) });
  },

  onCart() {
    wx.switchTab({ url: '/pages/index/index' });
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
      member: '__member__',
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
      if (actions[action] === '__member__') {
        this.setData({ memberOverlayOpen: true });
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
