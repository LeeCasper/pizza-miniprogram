// pages/tiers/tiers.js
const { api } = require('../../utils/api');
const { computeTier, buildBenefitTiers, loadTiers } = require('../../utils/tiers');
const { getSimpleTopBar } = require('../../utils/layout');
const app = getApp();

Page({
  data: {
    statusBarHeight: 44,
    topBarTotalHeight: 80,
    tiers: [],
    currentTier: null,
    selectedTier: null,
    selectedTierKey: '',
    nextTier: null,
    totalSpent: 0,
    totalSpentText: '0.00',
    progressPercent: 0,
    spentToNext: '0.00',
    progressFraction: '',
    hasNext: false,
    heroDiscountText: '',
    heroPointsText: '',
  },

  onLoad(options) {
    this.setData(getSimpleTopBar());
    this.loadData(options.levelKey || '');
  },

  loadData(scrollToKey) {
    const ui = app.globalData.userInfo || {};
    // 等级判定仅使用累计消费金额（与后端 computeTier 逻辑一致）
    const qualifyingAmount = parseFloat(ui.totalSpent || 0);

    loadTiers().then(apiTiers => {
      const tierInfo = computeTier(qualifyingAmount, apiTiers, ui.memberLevel);
      const tiers = buildBenefitTiers(apiTiers, tierInfo, qualifyingAmount);

      const currentTier = tiers.find(t => t.status === 'current') || tiers[0];
      const nextTier = tierInfo.next;
      const hasNext = !!nextTier;
      const rawDiff = hasNext ? nextTier.minSpent - qualifyingAmount : 0;
      const spentToNext = rawDiff > 0 ? rawDiff.toFixed(2) : '0.00';
      const upgradeReady = hasNext && rawDiff <= 0;
      const progressPercent = hasNext
        ? Math.min(100, Math.max(0, ((qualifyingAmount - tierInfo.current.minSpent) / (nextTier.minSpent - tierInfo.current.minSpent)) * 100))
        : 100;

      // Progress fraction text (e.g. "200/400")
      const currentMin = tierInfo.current.minSpent;
      const nextMin = hasNext ? nextTier.minSpent : currentMin;
      const progressFraction = hasNext
        ? Math.floor(qualifyingAmount - currentMin) + '/' + (nextMin - currentMin)
        : '';

      const targetKey = scrollToKey || tierInfo.current.levelKey;

      // Initial selected tier (the one navigated to, or current)
      const selectedTier = tiers.find(t => t.levelKey === targetKey) || currentTier;

      // Pre-compute hero display values (WXML can't call .toFixed)
      const heroDiscountText = currentTier.discountRate < 1 ? (currentTier.discountRate * 10).toFixed(1) + '折' : '';
      const heroPointsText = currentTier.pointsRewardRate > 1 ? 'x' + currentTier.pointsRewardRate : '';

      this.setData({
        tiers,
        currentTier,
        selectedTier,
        selectedTierKey: selectedTier.levelKey,
        heroDiscountText,
        heroPointsText,
        nextTier,
        hasNext,
        totalSpent: qualifyingAmount,
        totalSpentText: qualifyingAmount.toFixed(2),
        spentToNext,
        upgradeReady,
        progressFraction,
        progressPercent,
      });
    }).catch(() => {
      wx.showToast({ title: '加载失败', icon: 'none' });
    });
  },

  onBack() {
    wx.navigateBack();
  },

  // ── 点击横向对比卡片切换权益展示 ──
  onSelectTier(e) {
    const levelKey = e.currentTarget.dataset.levelKey;
    if (!levelKey || levelKey === this.data.selectedTierKey) return;
    const tier = this.data.tiers.find(t => t.levelKey === levelKey);
    if (tier) {
      this.setData({
        selectedTier: tier,
        selectedTierKey: levelKey,
      });
    }
  },

  noop() {},
});
