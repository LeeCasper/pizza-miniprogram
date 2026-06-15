// pages/profile/profile.js
const { api } = require('../../utils/api');
const app = getApp();

// ── 会员等级（Stitch 设计稿 1:1） ──────────────────
const TIERS = [
  { key: 'normal',   name: '普通', gradient: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)', textColor: '#1f2937', badgeBg: 'rgba(0,0,0,0.08)',    threshold: 0,    progressTrack: 'rgba(0,0,0,0.1)',   progressFill: 'rgba(0,0,0,0.5)' },
  { key: 'gold',     name: '黄金', gradient: 'linear-gradient(135deg, #fceabb 0%, #f8b500 100%)', textColor: '#451a03', badgeBg: 'rgba(255,255,255,0.4)', threshold: 1000, progressTrack: 'rgba(120,53,15,0.1)', progressFill: 'rgba(120,53,15,0.8)' },
  { key: 'platinum', name: '铂金', gradient: 'linear-gradient(135deg, #e2e8f0 0%, #f8fafc 50%, #cbd5e1 100%)', textColor: '#1e293b', badgeBg: 'rgba(255,255,255,0.5)', threshold: 3000, progressTrack: 'rgba(30,41,59,0.1)', progressFill: 'rgba(30,41,59,0.7)' },
  { key: 'diamond',  name: '钻石', gradient: 'linear-gradient(135deg, #111827 0%, #000000 100%)', textColor: '#ffffff', badgeBg: 'rgba(255,255,255,0.2)', threshold: 6000, progressTrack: 'rgba(255,255,255,0.2)', progressFill: 'rgba(255,255,255,0.8)' }
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

const CARD_OFFSETS = [0, 16, 36, 48]; // distance→translateY(rpx)

function buildTierCards(userTierIndex, userPoints, activeIndex) {
  const ai = activeIndex !== undefined ? activeIndex : userTierIndex;
  return TIERS.map((t, i) => {
    const isCurrent = i === userTierIndex;
    const isLocked = i > userTierIndex;
    const isUnlocked = i < userTierIndex;
    let growthText = '';
    if (isCurrent && i < TIERS.length - 1) {
      growthText = '成长值' + userPoints + ' 还需' + (TIER_THRESHOLDS[i + 1] - userPoints) + '升级';
    } else if (isCurrent) {
      growthText = '成长值' + userPoints + ' 已达最高等级';
    } else if (isLocked) {
      growthText = '成长值0 还需' + (TIER_THRESHOLDS[i] - (i > 0 ? TIER_THRESHOLDS[i - 1] : 0)) + '升级';
    } else {
      growthText = '已解锁全部权益';
    }
    let progressPercent = 100;
    if (isCurrent && i < TIERS.length - 1) {
      const lo = TIER_THRESHOLDS[i], hi = TIER_THRESHOLDS[i + 1];
      progressPercent = Math.round(((userPoints - lo) / (hi - lo)) * 100);
    } else if (isLocked) {
      progressPercent = 0;
    }
    return {
      key: t.key, name: t.name, gradient: t.gradient, textColor: t.textColor,
      badgeBg: t.badgeBg, threshold: t.threshold, progressTrack: t.progressTrack,
      progressFill: t.progressFill,
      isCurrent, isLocked, isUnlocked,
      growthText, progressPercent,
      lv: 'Lv' + i,
      offsetY: CARD_OFFSETS[Math.abs(i - ai)]
    };
  });
}

function applyCardOffsets(cards, activeIndex) {
  return cards.map((c, i) => ({ ...c, offsetY: CARD_OFFSETS[Math.abs(i - activeIndex)] }));
}

Page({
  data: {
    statusBarHeight: 44,
    topBarTotalHeight: 80,
    userInfo: {},
    tierCards: buildTierCards(0, 0),
    activeTierIndex: 0,
    userTierIndex: 0,
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

  onReady() {
    this.onMemberSwiperReady();
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
    const { tierIndex } = computeTier(ui.points || 0);

    this.setData({
      userInfo: {
        ...ui,
        memberLevel: TIERS[tierIndex].name,
        balanceText: '¥' + ((ui.balance || 0)).toFixed(2),
        cardCount: ui.cardCount || 0,
        bio: ui.bio || '享受美味每一天'
      },
      tierCards: buildTierCards(tierIndex, ui.points || 0),
      activeTierIndex: tierIndex,
      userTierIndex: tierIndex
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

  // ── 会员卡片横向滚动 + 下沉选中 ────────────
  onTierCardsScroll(e) {
    if (this._scrollTimer) clearTimeout(this._scrollTimer);
    this._scrollTimer = setTimeout(() => {
      const sl = e.detail.scrollLeft;
      const cardWidth = e.detail.scrollWidth / 4;
      const centerPos = sl + (this._swiperWidth || 375) / 2;
      let activeIndex = 0, minDist = Infinity;
      for (let i = 0; i < 4; i++) {
        const dist = Math.abs(centerPos - (i + 0.5) * cardWidth);
        if (dist < minDist) { minDist = dist; activeIndex = i; }
      }
      if (activeIndex !== this.data.activeTierIndex) {
        this.setData({
          activeTierIndex: activeIndex,
          tierCards: applyCardOffsets(this.data.tierCards, activeIndex)
        });
      }
    }, 80);
  },

  onTierCardTap(e) {
    const idx = parseInt(e.currentTarget.dataset.index);
    if (idx === this.data.activeTierIndex) return;
    this.setData({
      activeTierIndex: idx,
      tierCards: applyCardOffsets(this.data.tierCards, idx)
    });
    // 滚动到正中间
    const win = wx.getWindowInfo();
    const rpx = win.windowWidth / 750;
    const cw = (this._swiperWidth || win.windowWidth) * 0.85;
    const gap = 32 * rpx;
    const pad = 32 * rpx;
    const target = pad + idx * (cw + gap) - ((this._swiperWidth || win.windowWidth) - cw) / 2;
    wx.createSelectorQuery().select('#tierCardsScroll').node((res) => {
      if (res && res[0]) res[0].scrollTo({ left: Math.max(0, target), animated: true });
    }).exec();
  },

  onMemberSwiperReady() {
    wx.createSelectorQuery().select('.member-tier-section').boundingClientRect((rect) => {
      if (rect) this._swiperWidth = rect.width;
    }).exec();
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
