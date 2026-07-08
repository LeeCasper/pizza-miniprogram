// utils/tiers.js — 会员等级共享模块
// 统一 FALLBACK_TIERS、computeTier、buildTierCards、buildBenefitTiers、loadTiers
// 消费方：main.js、profile.js、tiers.js
const { api } = require('./api');

// ── 会员等级（API 驱动 + 本地回退）─────────────
const FALLBACK_TIERS = [
  { levelKey: 'silver',    name: '银卡会员',   levelIndex: 1, minSpent:     0, discountRate: 1.00, pointsRewardRate: 1.00, birthdayGift: '生日当月享9折优惠一次',       couponValue:  0, accentColor: '#78d2ab', bgStartColor: '#78d2ab', bgEndColor: '#5a9e80', bgImage: '/images/tier-bg-silver.jpg' },
  { levelKey: 'gold',      name: '金卡会员',   levelIndex: 2, minSpent:   200, discountRate: 0.98, pointsRewardRate: 1.00, birthdayGift: '生日当月享8折优惠一次',       couponValue:  5, accentColor: '#8fc5fe', bgStartColor: '#8fc5fe', bgEndColor: '#6b94be', bgImage: '/images/tier-bg-gold.jpg' },
  { levelKey: 'rose_gold', name: '玫瑰金会员', levelIndex: 3, minSpent:  1000, discountRate: 0.95, pointsRewardRate: 1.20, birthdayGift: '生日当月享7折优惠+专属礼物',  couponValue: 10, accentColor: '#ada1f0', bgStartColor: '#ada1f0', bgEndColor: '#8279b4', bgImage: '/images/tier-bg-rosegold.jpg' },
  { levelKey: 'platinum',  name: '铂金会员',   levelIndex: 4, minSpent:  3000, discountRate: 0.90, pointsRewardRate: 1.50, birthdayGift: '生日当月享6折优惠+上门配送',  couponValue: 20, accentColor: '#f8b95c', bgStartColor: '#f8b95c', bgEndColor: '#ba8b45', bgImage: '/images/tier-bg-platinum.jpg' },
  { levelKey: 'diamond',   name: '钻石会员',   levelIndex: 5, minSpent: 10000, discountRate: 0.85, pointsRewardRate: 2.00, birthdayGift: '生日当月享5折优惠+专属客服',  couponValue: 50, accentColor: '#ee6155', bgStartColor: '#ee6155', bgEndColor: '#b34940', bgImage: '/images/tier-bg-diamond.jpg' },
];

// ── 计算当前等级 ──────────────────────────────
function computeTier(totalSpent, tiers, memberLevel) {
  let current = tiers[0], next = tiers[1];
  // 优先使用服务端 memberLevel（管理员可直接修改等级）
  if (memberLevel) {
    const idx = tiers.findIndex(t => t.levelKey === memberLevel);
    if (idx >= 0) {
      current = tiers[idx];
      next = tiers[idx + 1] || null;
      return { current, next };
    }
  }
  // 回退：从 totalSpent 计算
  for (let i = tiers.length - 1; i >= 0; i--) {
    if (totalSpent >= tiers[i].minSpent) { current = tiers[i]; next = tiers[i + 1] || null; break; }
  }
  return { current, next };
}

// ── 构建个人页/主页的等级卡片数据 ───────────────
function buildTierCards(apiTiers, userTier) {
  const totalSpent = userTier._totalSpent || 0;
  return apiTiers.map(t => {
    const isActive = t.levelKey === userTier.current.levelKey;
    let progressText = '', actionText = '', progressPercent = 0;
    if (t.levelIndex < userTier.current.levelIndex) {
      progressText = '已达成';
      progressPercent = 100;
      actionText = t.discountRate < 1 ? '享' + ((1 - t.discountRate) * 100).toFixed(0) + '%折扣' : '查看特权';
    } else if (isActive) {
      if (userTier.next) {
        const diff = userTier.next.minSpent - totalSpent;
        if (diff > 0) {
          progressText = '还差¥' + diff.toFixed(2) + '升级' + userTier.next.name;
          progressPercent = Math.min(100, Math.max(0,
            ((totalSpent - userTier.current.minSpent) / (userTier.next.minSpent - userTier.current.minSpent)) * 100
          ));
        } else {
          progressText = '已满足' + userTier.next.name + '升级条件';
          progressPercent = 100;
        }
        actionText = '查看权益';
      } else {
        progressText = '已达最高等级';
        progressPercent = 100;
        actionText = '尊享特权';
      }
    } else {
      progressText = '消费满¥' + t.minSpent + '解锁';
      progressPercent = 0;
      actionText = '查看权益';
    }
    const discountText = t.discountRate < 1 ? (t.discountRate * 10).toFixed(1).replace(/\.0$/, '') + '折' : '';
    const bgStyle = t.bgImage ? 'background-image:url(' + t.bgImage + ');background-size:cover;background-position:center;' : '';
    const status = isActive ? 'current' : (t.levelIndex < userTier.current.levelIndex ? 'achieved' : 'locked');
    return {
      levelKey: t.levelKey, levelIndex: t.levelIndex, name: t.name,
      accentColor: t.accentColor, bgStartColor: t.bgStartColor, bgEndColor: t.bgEndColor,
      bgImage: t.bgImage || null, bgStyle,
      discountRate: t.discountRate, pointsRewardRate: t.pointsRewardRate,
      birthdayGift: t.birthdayGift, couponValue: t.couponValue || 0,
      discountText, progressPercent, status,
      isActive, progressText, actionText,
    };
  });
}

// ── 构建权益页 benefit items（2列网格） ──────────
function buildBenefitItems(tier) {
  const items = [];

  // 1. 折扣优惠
  if (tier.discountRate < 1) {
    const discountNum = (tier.discountRate * 10).toFixed(1);
    items.push({ icon: '/images/icon-discount.png', iconType: 'image', iconBg: 'benefit-icon-discount', label: '折扣优惠', desc: '消费享专属折扣', value: discountNum + '折' });
  }

  // 2. 积分倍率
  if (tier.pointsRewardRate > 1) {
    items.push({ icon: '/images/icon-points-rate.png', iconType: 'image', iconBg: 'benefit-icon-points', label: '积分倍率', desc: '消费积分获取倍率', value: tier.pointsRewardRate.toFixed(1) + '倍' });
  } else {
    items.push({ icon: '/images/icon-points-rate.png', iconType: 'image', iconBg: 'benefit-icon-points', label: '积分倍率', desc: '消费积分获取倍率', value: '基础' });
  }

  // 3. 消费返积分
  const cashbackRate = tier.pointsRewardRate;
  items.push({ icon: '/images/grid-points.png', iconType: 'image', iconBg: 'benefit-icon-cashback', label: '消费返积分', desc: '每消费1元返积分', value: cashbackRate.toFixed(0) + '积分' });

  // 4. 生日礼遇
  items.push({ icon: '/images/icon-birthday.png', iconType: 'image', iconBg: 'benefit-icon-birthday', label: '生日礼遇', desc: '生日当月专属福利', value: tier.birthdayGift ? '专属' : '无' });

  // 5. 升级礼券
  if (tier.couponValue > 0) {
    items.push({ icon: '/images/grid-discount.png', iconType: 'image', iconBg: 'benefit-icon-coupon', label: '专享优惠券', desc: '升级即送优惠券', value: '¥' + tier.couponValue });
  }

  // 6. 运费优惠 (rose_gold+)
  if (tier.levelIndex >= 3) {
    items.push({ icon: '/images/icon-shipping-fee.png', iconType: 'image', iconBg: 'benefit-icon-shipping', label: '运费优惠', desc: tier.levelIndex >= 4 ? '免配送费' : '运费减免', value: tier.levelIndex >= 4 ? '免费' : '减半' });
  }

  // 7. 专属客服 (platinum+)
  if (tier.levelIndex >= 4) {
    items.push({ icon: '🎧', iconType: 'emoji', iconBg: 'benefit-icon-service', label: '专属客服', desc: '优先客服响应', value: '优先' });
  }

  // 8. 新品优先 (gold+)
  if (tier.levelIndex >= 2) {
    items.push({ icon: '/images/icon-new.png', iconType: 'image', iconBg: 'benefit-icon-new', label: '新品优先购', desc: '新品优先购买权', value: '优先' });
  }

  return items;
}

// ── 构建权益页的等级数据（含 rangeText、benefitItems） ──
function buildBenefitTiers(apiTiers, userTier, totalSpent) {
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

    const maxSpent = maxSpents[i];
    const rangeText = maxSpent ? '¥' + t.minSpent + ' - ¥' + maxSpent : '¥' + t.minSpent + '以上';

    let progressText = '', progressPercent = 0;
    if (status === 'achieved') {
      progressText = '已达成';
      progressPercent = 100;
    } else if (status === 'current') {
      if (userTier.next) {
        const diff = userTier.next.minSpent - totalSpent;
        if (diff > 0) {
          progressPercent = Math.min(100, Math.max(0,
            ((totalSpent - userTier.current.minSpent) / (userTier.next.minSpent - userTier.current.minSpent)) * 100
          ));
          progressText = '还差¥' + diff.toFixed(2) + '升级' + userTier.next.name;
        } else {
          progressPercent = 100;
          progressText = '已满足' + userTier.next.name + '升级条件';
        }
      } else {
        progressText = '已达最高等级';
        progressPercent = 100;
      }
    } else {
      const diff = t.minSpent - totalSpent;
      progressText = diff > 0 ? '还需消费¥' + diff.toFixed(2) : '已达标';
      progressPercent = diff > 0 ? 0 : 100;
    }

    const benefitItems = buildBenefitItems(t);
    const bgStyle = t.bgImage ? 'background-image:url(' + t.bgImage + ');background-size:cover;background-position:center;' : '';

    return {
      levelKey: t.levelKey, levelIndex: t.levelIndex, name: t.name,
      minSpent: t.minSpent, discountRate: t.discountRate, pointsRewardRate: t.pointsRewardRate,
      birthdayGift: t.birthdayGift, couponValue: t.couponValue,
      accentColor: t.accentColor, bgStartColor: t.bgStartColor, bgEndColor: t.bgEndColor,
      bgImage: t.bgImage || null, bgStyle,
      status, discountText, pointsText, progressText, progressPercent, rangeText,
      benefitItems,
    };
  });
}

// ── 加载等级配置（模块级缓存，替代各页面 _ensureTiersLoaded） ──
let _cachedTiers = null;

function loadTiers() {
  if (_cachedTiers) return Promise.resolve(_cachedTiers);
  return api.get('/user/member-tiers').then(res => {
    _cachedTiers = (res && res.code === 0 && res.data && res.data.length)
      ? res.data.map(t => { const fb = FALLBACK_TIERS.find(f => f.levelKey === t.levelKey); return fb ? { ...fb, ...t } : t; })
      : FALLBACK_TIERS;
    return _cachedTiers;
  }).catch(() => {
    _cachedTiers = FALLBACK_TIERS;
    return _cachedTiers;
  });
}

function clearTierCache() { _cachedTiers = null; }

module.exports = { FALLBACK_TIERS, computeTier, buildTierCards, buildBenefitTiers, loadTiers, clearTierCache };
