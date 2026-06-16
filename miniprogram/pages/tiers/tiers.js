// pages/tiers/tiers.js
const { api } = require('../../utils/api');
const app = getApp();

// ── 会员等级（API 驱动 + 本地回退）─────────────
const FALLBACK_TIERS = [
  { levelKey: 'silver',    name: '银卡会员',   levelIndex: 1, minSpent:     0, discountRate: 1.00, pointsRewardRate: 1.00, birthdayGift: '生日当月享9折优惠一次',       couponValue:  0, accentColor: '#c0c0c0', bgStartColor: 'rgba(60,60,65,0.88)',  bgEndColor: 'rgba(25,25,30,0.95)', bgImage: '/images/tier-bg-silver.png' },
  { levelKey: 'gold',      name: '金卡会员',   levelIndex: 2, minSpent:   200, discountRate: 0.98, pointsRewardRate: 1.00, birthdayGift: '生日当月享8折优惠一次',       couponValue:  5, accentColor: '#f2ca50', bgStartColor: 'rgba(45,42,33,0.88)',  bgEndColor: 'rgba(17,14,7,0.95)', bgImage: null },
  { levelKey: 'rose_gold', name: '玫瑰金会员', levelIndex: 3, minSpent:  1000, discountRate: 0.95, pointsRewardRate: 1.20, birthdayGift: '生日当月享7折优惠+专属礼物',  couponValue: 10, accentColor: '#e0a2a2', bgStartColor: 'rgba(50,35,35,0.88)',  bgEndColor: 'rgba(20,15,15,0.95)', bgImage: null },
  { levelKey: 'platinum',  name: '铂金会员',   levelIndex: 4, minSpent:  3000, discountRate: 0.90, pointsRewardRate: 1.50, birthdayGift: '生日当月享6折优惠+上门配送',  couponValue: 20, accentColor: '#b4bed2', bgStartColor: 'rgba(35,40,50,0.88)',  bgEndColor: 'rgba(15,17,25,0.95)', bgImage: null },
  { levelKey: 'diamond',   name: '钻石会员',   levelIndex: 5, minSpent: 10000, discountRate: 0.85, pointsRewardRate: 2.00, birthdayGift: '生日当月享5折优惠+专属客服',  couponValue: 50, accentColor: '#82c8f0', bgStartColor: 'rgba(20,35,50,0.88)',  bgEndColor: 'rgba(10,15,25,0.95)', bgImage: null },
];

function computeTier(totalSpent, tiers) {
  let current = tiers[0], next = tiers[1];
  for (let i = tiers.length - 1; i >= 0; i--) {
    if (totalSpent >= tiers[i].minSpent) { current = tiers[i]; next = tiers[i + 1] || null; break; }
  }
  return { current, next };
}

function buildBenefitTiers(apiTiers, userTier, totalSpent) {
  // Build the spend ceiling for each tier (next tier's minSpent - 0.01, or "以上" for highest)
  const maxSpents = apiTiers.map((t, i) => {
    const next = apiTiers[i + 1];
    return next ? next.minSpent - 0.01 : null;
  });

  return apiTiers.map((t, i) => {
    const status = t.levelIndex < userTier.current.levelIndex ? 'achieved'
      : t.levelIndex === userTier.current.levelIndex ? 'current'
      : 'upcoming';

    const discountText = t.discountRate < 1 ? (t.discountRate * 10).toFixed(1) + '折优惠' : '';
    const pointsText = t.pointsRewardRate > 1 ? t.pointsRewardRate.toFixed(1) + '倍' : '';

    // Spending range string
    const maxSpent = maxSpents[i];
    const rangeText = maxSpent ? '¥' + t.minSpent + ' - ¥' + maxSpent : '¥' + t.minSpent + '以上';

    let progressText = '', progressPercent = 0;
    if (status === 'achieved') {
      progressText = '已达成';
      progressPercent = 100;
    } else if (status === 'current') {
      if (userTier.next) {
        progressPercent = Math.min(100, Math.max(0,
          ((totalSpent - userTier.current.minSpent) / (userTier.next.minSpent - userTier.current.minSpent)) * 100
        ));
        const diff = (userTier.next.minSpent - totalSpent).toFixed(2);
        progressText = '还差¥' + diff + '升级' + userTier.next.name;
      } else {
        progressText = '已达最高等级';
        progressPercent = 100;
      }
    } else {
      const diff = (t.minSpent - totalSpent).toFixed(2);
      progressText = '还需消费¥' + diff;
      progressPercent = 0;
    }

    // Generate benefit items for the 2-column grid
    const benefitItems = buildBenefitItems(t);

    return {
      levelKey: t.levelKey, levelIndex: t.levelIndex, name: t.name,
      minSpent: t.minSpent, discountRate: t.discountRate, pointsRewardRate: t.pointsRewardRate,
      birthdayGift: t.birthdayGift, couponValue: t.couponValue,
      accentColor: t.accentColor, bgStartColor: t.bgStartColor, bgEndColor: t.bgEndColor,
      bgImage: t.bgImage || null,
      status, discountText, pointsText, progressText, progressPercent, rangeText,
      benefitItems,
    };
  });
}

// ── Build benefit items for the 2-column grid ──
function buildBenefitItems(tier) {
  const items = [];

  // 1. 折扣优惠 (all tiers that have discount)
  if (tier.discountRate < 1) {
    const discountNum = (tier.discountRate * 10).toFixed(1);
    items.push({
      icon: '🏷️',
      iconBg: 'benefit-icon-discount',
      label: '折扣优惠',
      desc: '消费享专属折扣',
      value: discountNum + '折',
    });
  }

  // 2. 积分倍率
  if (tier.pointsRewardRate > 1) {
    items.push({
      icon: '⭐',
      iconBg: 'benefit-icon-points',
      label: '积分倍率',
      desc: '消费积分获取倍率',
      value: tier.pointsRewardRate.toFixed(1) + '倍',
    });
  } else {
    items.push({
      icon: '⭐',
      iconBg: 'benefit-icon-points',
      label: '积分倍率',
      desc: '消费积分获取倍率',
      value: '基础',
    });
  }

  // 3. 消费返积分 (all tiers)
  const cashbackRate = tier.pointsRewardRate;
  items.push({
    icon: '💰',
    iconBg: 'benefit-icon-cashback',
    label: '消费返积分',
    desc: '每消费1元返积分',
    value: cashbackRate.toFixed(0) + '积分',
  });

  // 4. 生日礼遇
  items.push({
    icon: '🎂',
    iconBg: 'benefit-icon-birthday',
    label: '生日礼遇',
    desc: '生日当月专属福利',
    value: tier.birthdayGift ? '专属' : '无',
  });

  // 5. 升级礼券 (only if couponValue > 0)
  if (tier.couponValue > 0) {
    items.push({
      icon: '🎫',
      iconBg: 'benefit-icon-coupon',
      label: '专享优惠券',
      desc: '升级即送优惠券',
      value: '¥' + tier.couponValue,
    });
  }

  // 6. 运费优惠 (rose_gold+)
  if (tier.levelIndex >= 3) {
    items.push({
      icon: '🚚',
      iconBg: 'benefit-icon-shipping',
      label: '运费优惠',
      desc: tier.levelIndex >= 4 ? '免配送费' : '运费减免',
      value: tier.levelIndex >= 4 ? '免费' : '减半',
    });
  }

  // 7. 专属客服 (platinum+)
  if (tier.levelIndex >= 4) {
    items.push({
      icon: '🎧',
      iconBg: 'benefit-icon-service',
      label: '专属客服',
      desc: '优先客服响应',
      value: '优先',
    });
  }

  // 8. 新品优先 (gold+)
  if (tier.levelIndex >= 2) {
    items.push({
      icon: '🆕',
      iconBg: 'benefit-icon-new',
      label: '新品优先购',
      desc: '新品优先购买权',
      value: '优先',
    });
  }

  return items;
}

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
    const sh = app.globalData.statusBarHeight || 44;
    this.setData({
      statusBarHeight: sh,
      topBarTotalHeight: sh + 44,
    });
    this.loadData(options.levelKey || '');
  },

  loadData(scrollToKey) {
    const ui = app.globalData.userInfo || {};
    const totalSpent = parseFloat(ui.totalSpent || 0);

    this._ensureTiersLoaded().then(apiTiers => {
      const tierInfo = computeTier(totalSpent, apiTiers);
      const tiers = buildBenefitTiers(apiTiers, tierInfo, totalSpent);

      const currentTier = tiers.find(t => t.status === 'current') || tiers[0];
      const nextTier = tierInfo.next;
      const hasNext = !!nextTier;
      const spentToNext = hasNext ? (nextTier.minSpent - totalSpent).toFixed(2) : '0.00';
      const progressPercent = hasNext
        ? Math.min(100, Math.max(0, ((totalSpent - tierInfo.current.minSpent) / (nextTier.minSpent - tierInfo.current.minSpent)) * 100))
        : 100;

      // Progress fraction text (e.g. "200/400")
      const currentMin = tierInfo.current.minSpent;
      const nextMin = hasNext ? nextTier.minSpent : currentMin;
      const progressFraction = hasNext
        ? Math.floor(totalSpent - currentMin) + '/' + (nextMin - currentMin)
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
        totalSpent,
        totalSpentText: totalSpent.toFixed(2),
        spentToNext,
        progressFraction,
        progressPercent,
      });
    }).catch(() => {
      wx.showToast({ title: '加载失败', icon: 'none' });
    });
  },

  _ensureTiersLoaded() {
    if (this._apiTiers) return Promise.resolve(this._apiTiers);
    return api.get('/user/member-tiers').then(res => {
      this._apiTiers = (res && res.code === 0 && res.data && res.data.length)
        ? res.data
        : FALLBACK_TIERS;
      return this._apiTiers;
    }).catch(() => {
      this._apiTiers = FALLBACK_TIERS;
      return this._apiTiers;
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
