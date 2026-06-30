/**
 * Shared profile methods for main.js and profile.js
 *
 * Both pages render the "我的" profile tab with near-identical logic.
 * This module extracts the 14 duplicated methods into a single source of truth.
 *
 * Usage:
 *   const { profileMethods, loadProfileCore } = require('../../utils/profileShared');
 *   Page({
 *     ...profileMethods,
 *     _reloadProfile() { this.loadMyData(); },   // ← required contract
 *     loadMyData() { loadProfileCore(this, hooks); },
 *   });
 *
 * Contract: consuming pages MUST define `_reloadProfile()` — it is called
 * after avatar upload and profile save to refresh page data.
 */

const { api, fixImageUrl, BASE_URL } = require('./api');
const { computeTier, buildTierCards, loadTiers } = require('./tiers');
const { logout } = require('./auth');

// ── 生日倒计时计算 ──────────────────────────────

/**
 * 计算生日展示信息（纯前端，基于本地日期）
 * @param {string|null} birthdayStr  'YYYY-MM-DD' 或 null
 * @returns {{ birthdayDisplay: string, birthdayCountdown: string, isBirthdayToday: boolean, hasBirthday: boolean }}
 */
function computeBirthdayInfo(birthdayStr) {
  if (!birthdayStr) {
    return { birthdayDisplay: '', birthdayCountdown: '', isBirthdayToday: false, hasBirthday: false };
  }
  var parts = birthdayStr.split('-');
  var month = parseInt(parts[1], 10);
  var day = parseInt(parts[2], 10);
  var today = new Date();
  var todayMonth = today.getMonth() + 1;
  var todayDay = today.getDate();
  var todayYear = today.getFullYear();
  var isBirthdayToday = (todayMonth === month && todayDay === day);
  var birthdayDisplay = month + '月' + day + '日';
  var birthdayCountdown = '';
  if (!isBirthdayToday) {
    var nextBirthday = new Date(todayYear, month - 1, day);
    var todayMidnight = new Date(todayYear, today.getMonth(), todayDay);
    if (nextBirthday.getTime() <= todayMidnight.getTime()) {
      nextBirthday = new Date(todayYear + 1, month - 1, day);
    }
    var diffDays = Math.ceil((nextBirthday.getTime() - todayMidnight.getTime()) / 86400000);
    birthdayCountdown = '距生日还有' + diffDays + '天';
  }
  return { birthdayDisplay: birthdayDisplay, birthdayCountdown: birthdayCountdown, isBirthdayToday: isBirthdayToday, hasBirthday: true };
}

// ── Mixin methods (spread into Page) ─────────────────────

const profileMethods = {

  /** 上传头像文件，返回 Promise<serverUrl> */
  _uploadAvatar(filePath) {
    return new Promise((resolve, reject) => {
      wx.uploadFile({
        url: BASE_URL + '/upload/avatar', filePath, name: 'file',
        header: { 'Authorization': 'Bearer ' + (wx.getStorageSync('token') || '') },
        success(result) {
          if (result.statusCode === 200) {
            try {
              const data = JSON.parse(result.data);
              if (data.code === 0) { resolve(fixImageUrl(data.data.url)); return; }
            } catch (_) {}
          }
          reject(new Error('上传失败'));
        },
        fail: reject,
      });
    });
  },

  onChooseAvatar() {
    const that = this;
    const handleImage = (tempFilePath) => {
      // 编辑抽屉内：仅暂存本地路径，保存时统一上传
      if (that.data.editProfileOpen) { that.setData({ 'editForm.avatar': tempFilePath }); return; }
      // 直接点击头像：立即上传
      wx.showLoading({ title: '上传中...' });
      that._uploadAvatar(tempFilePath).then(url => {
        wx.hideLoading();
        getApp().globalData.userInfo.avatar = url;
        that._reloadProfile();
        wx.showToast({ title: '头像已更新', icon: 'success' });
      }).catch(() => {
        wx.hideLoading();
        wx.showToast({ title: '上传失败，请重试', icon: 'none' });
      });
    };
    wx.chooseMedia({
      count: 1, mediaType: ['image'], sourceType: ['album', 'camera'],
      success(res) { handleImage(res.tempFiles[0].tempFilePath); },
      fail(err) {
        console.warn('[avatar] chooseMedia fail:', err);
        // 用户取消不回退
        if (err && err.errMsg && err.errMsg.indexOf('cancel') > -1) return;
        // 回退到旧版 API
        wx.chooseImage({
          count: 1, sizeType: ['compressed'], sourceType: ['album', 'camera'],
          success(r) { handleImage(r.tempFilePaths[0]); },
          fail(e) {
            console.warn('[avatar] chooseImage fail:', e);
            var msg = (e && e.errMsg) || '';
            if (msg.indexOf('cancel') === -1) {
              wx.showToast({ title: '无法选择图片', icon: 'none' });
            }
          }
        });
      }
    });
  },

  onOpenEditProfile() {
    const ui = this.data.userInfo;
    this.setData({ editProfileOpen: true, editForm: { name: ui.name || '', bio: ui.bio || '', avatar: ui.avatar || '', birthday: ui.birthday || '' } });
  },

  onCloseEditProfile() { this.setData({ editProfileOpen: false }); },

  onNameInput(e) { this.setData({ 'editForm.name': e.detail.value }); },

  onBioInput(e) { this.setData({ 'editForm.bio': e.detail.value }); },

  onBirthdayChange(e) { this.setData({ 'editForm.birthday': e.detail.value }); },

  onBirthdayRowTap() {
    if (!this.data.userInfo.birthday) {
      this.onOpenEditProfile();
    }
  },

  onSaveProfile() {
    const { editForm } = this.data;
    if (!editForm.name.trim()) { wx.showToast({ title: '请输入昵称', icon: 'none' }); return; }
    const ui = getApp().globalData.userInfo;
    const name = editForm.name.trim();
    const bio = editForm.bio.trim();
    const birthday = editForm.birthday || '';
    const avatarChanged = editForm.avatar && editForm.avatar !== ui.avatar && !editForm.avatar.startsWith('https://');

    // 乐观更新 UI + 关闭抽屉
    ui.name = name; ui.bio = bio; ui.birthday = birthday || null;
    var bdInfo = computeBirthdayInfo(birthday || null);
    this.setData({
      editProfileOpen: false,
      userInfo: { ...this.data.userInfo, name, bio, birthday: birthday || null, avatar: editForm.avatar || ui.avatar },
      birthdayDisplay: bdInfo.birthdayDisplay,
      birthdayCountdown: bdInfo.birthdayCountdown,
      isBirthdayToday: bdInfo.isBirthdayToday,
      hasBirthday: bdInfo.hasBirthday,
    });

    // 头像变更时先上传，再保存文本字段，最后刷新
    const avatarPromise = avatarChanged
      ? this._uploadAvatar(editForm.avatar).then(url => { ui.avatar = url; }).catch(() => {})
      : Promise.resolve();

    const that = this;
    avatarPromise.then(() => api.put('/user/profile', { name, bio, birthday })).then(() => {
      wx.showToast({ title: '保存成功', icon: 'success' });
      that._reloadProfile();
    }).catch(() => { wx.showToast({ title: '保存成功（本地）', icon: 'success' }); });
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

  onLogout() { logout(); },

  // ── 微信快捷登录 ──────────────────────────────

  onOpenQuickLogin() {
    this.setData({ showQuickLogin: true });
  },

  onQuickLoginDone(e) {
    // 立即同步登录后的用户数据到页面, 避免 loadProfileCore API 回调覆盖
    var app = getApp();
    var detail = (e && e.detail) || {};
    var ui = normalizeUserInfo(app.globalData.userInfo);
    var qlAvatar = detail.avatar || ui.avatar || '';
    var qlName = detail.name || ui.name || '';
    var qlPhone = detail.phone || ui.phone || '';
    console.log('[ql-done] avatar:', JSON.stringify(qlAvatar), 'name:', JSON.stringify(qlName), 'phone:', JSON.stringify(qlPhone));
    app.globalData._qlProtected = { avatar: qlAvatar, name: qlName, phone: qlPhone, ts: Date.now() };
    app.globalData.userInfo = { ...ui, avatar: qlAvatar || ui.avatar, name: qlName || ui.name, phone: qlPhone || ui.phone };
    wx.setStorageSync('userInfo', app.globalData.userInfo);
    this.setData({
      showQuickLogin: false,
      userInfo: { ...app.globalData.userInfo, balanceText: '¥' + ((app.globalData.userInfo.balance || 0)).toFixed(2), cardCount: app.globalData.userInfo.cardCount || 0, bio: app.globalData.userInfo.bio || '享受美味每一天' },
    });
    this._reloadProfile();
  },

  onQuickLoginSkip() {
    this.setData({ showQuickLogin: false });
  },

  // 头像点击：未登录→快捷登录，已登录→换头像
  onAvatarTap() {
    if (this.data.userInfo.phone) {
      this.onChooseAvatar();
    } else {
      this.onOpenQuickLogin();
    }
  },

  // 个人信息区点击：未登录→快捷登录，已登录→编辑资料
  onProfileInfoTap() {
    if (this.data.userInfo.phone) {
      this.onOpenEditProfile();
    } else {
      this.onOpenQuickLogin();
    }
  },

  noop() {},
};

function normalizeUserInfo(ui) {
  var user = ui || {};
  var avatar = user.avatar ? fixImageUrl(user.avatar) : '';
  return {
    ...user,
    avatar: avatar,
    name: user.name || '',
    phone: user.phone || '',
    bio: user.bio || '享受美味每一天',
    balanceText: '¥' + ((user.balance || 0)).toFixed(2),
    cardCount: user.cardCount || 0,
  };
}

// ── Core profile data loader ─────────────────────────────

/**
 * Load user profile + tier data, compute tier cards, and setData.
 *
 * @param {Object} page   - Page instance (this)
 * @param {Object} [hooks]
 * @param {Function} [hooks.beforeMerge(freshUi, cachedUi)] - mutate freshUi before it replaces cached data
 * @param {Function} [hooks.afterLoad(apiTiers, ui)]        - called after setData (this = page)
 */
function loadProfileCore(page, hooks) {
  var _hooks = hooks || {};
  const app = getApp();
  const cachedUi = normalizeUserInfo(app.globalData.userInfo);
  app.globalData.userInfo = cachedUi;
  const cachedBd = computeBirthdayInfo(cachedUi.birthday || null);
  page.setData({
    userInfo: cachedUi,
    birthdayDisplay: cachedBd.birthdayDisplay,
    birthdayCountdown: cachedBd.birthdayCountdown,
    isBirthdayToday: cachedBd.isBirthdayToday,
    hasBirthday: cachedBd.hasBirthday,
  });

  // 并行获取最新用户数据 & 等级配置，只构建一次卡片（避免 swiper 连续两次 setData 导致抖动）
  return Promise.all([
    api.get('/user/profile').then(function (res) { return res.code === 0 ? res.data : null; }).catch(function (e) { console.log('[profile] /user/profile API error:', e); return null; }),
    loadTiers(),
  ]).then(function (results) {
    var freshUi = results[0];
    var apiTiers = results[1];
    // 重新读取 globalData（此时 doLogin 可能已完成，有最新的 avatar）
    var latestGlobal = app.globalData.userInfo || {};
    console.log('[profile] After API — freshUi.avatar:', JSON.stringify(freshUi && freshUi.avatar), 'latestGlobal.avatar:', JSON.stringify(latestGlobal.avatar), 'cachedUi.avatar:', JSON.stringify(cachedUi.avatar), '_quickLoginJustDone:', app.globalData._quickLoginJustDone);
    var ui = cachedUi;
    if (!freshUi) {
      console.log('[profile] ERROR: freshUi is null/undefined — API returned no data, using cachedUi as fallback');
    }
    if (freshUi) {
      // hook: 页面可在合并前修改 freshUi（例如 optimistic totalSpent 保护）
      if (_hooks.beforeMerge) _hooks.beforeMerge(freshUi, cachedUi);
      // 快捷登录刚完成：avatar/name/phone 以组件写入值为准（10s 时间窗，支持并发 loadProfileCore）
      var qlp = app.globalData._qlProtected;
      if (qlp && (Date.now() - qlp.ts < 10000)) {
        console.log('[profile] _qlProtected active — ts:', qlp.ts, 'age:', Date.now() - qlp.ts, 'ms');
        if (qlp.avatar) freshUi.avatar = qlp.avatar;
        if (qlp.name) freshUi.name = qlp.name;
        if (qlp.phone) freshUi.phone = qlp.phone;
      }
      // 保护已登录写入的字段：若 API 返回空值，保留缓存/globalData 中的最新值
      if (!freshUi.phone && (cachedUi.phone || latestGlobal.phone)) freshUi.phone = cachedUi.phone || latestGlobal.phone;
      if (!freshUi.name && (cachedUi.name || latestGlobal.name)) freshUi.name = cachedUi.name || latestGlobal.name;
      if (!freshUi.avatar && (cachedUi.avatar || latestGlobal.avatar)) freshUi.avatar = cachedUi.avatar || latestGlobal.avatar;
      // Fix avatar URL for real device (relative path → full https URL)
      if (freshUi.avatar) freshUi.avatar = fixImageUrl(freshUi.avatar);
      console.log('[profile] Before setData 2 — ui.avatar:', JSON.stringify(freshUi.avatar), 'ui.phone:', JSON.stringify(freshUi.phone));
      var ui = normalizeUserInfo(freshUi);
      app.globalData.userInfo = ui;
      wx.setStorageSync('userInfo', ui);
    }
    // 等级判定仅使用累计消费金额（与后端 computeTier 逻辑一致）
    var qualifyingAmount = (ui.totalSpent || 0);
    var tierInfo = computeTier(qualifyingAmount, apiTiers, ui.memberLevel);
    tierInfo._totalSpent = qualifyingAmount;
    var tierCards = buildTierCards(apiTiers, tierInfo);
    var activeTierIndex = tierInfo.current.levelIndex - 1;
    var bdInfo = computeBirthdayInfo(ui.birthday || null);
    page.setData({
      userInfo: { ...ui, balanceText: '¥' + ((ui.balance || 0)).toFixed(2), cardCount: ui.cardCount || 0, bio: ui.bio || '享受美味每一天' },
      tierCards: tierCards,
      activeTierIndex: activeTierIndex,
      birthdayDisplay: bdInfo.birthdayDisplay,
      birthdayCountdown: bdInfo.birthdayCountdown,
      isBirthdayToday: bdInfo.isBirthdayToday,
      hasBirthday: bdInfo.hasBirthday,
    });
    // hook: 加载完成后执行自定义逻辑（例如缓存 tiers、重算价格）
    if (_hooks.afterLoad) _hooks.afterLoad.call(page, apiTiers, ui);
  }).catch(function (err) {
    console.error('[profile] loadProfileCore Promise chain threw:', err);
  });
}

module.exports = { profileMethods, loadProfileCore };
