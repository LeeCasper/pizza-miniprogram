const memberTierService = require('../services/memberTierService');

// ── 内存缓存（60 秒 TTL）────────────────────────
let _cache = null;
let _cacheTime = 0;
const CACHE_TTL = 60_000;

// ── 硬编码回退（DB 不可用时使用）───────────────
const FALLBACK_TIERS = [
  { levelKey: 'silver',    name: '银卡会员',   levelIndex: 1, minSpent:     0, discountRate: 1.00, pointsRewardRate: 1.00, birthdayGift: '生日当月享9折优惠一次',       couponValue:  0, accentColor: '#78d2ab' },
  { levelKey: 'gold',      name: '金卡会员',   levelIndex: 2, minSpent:   200, discountRate: 0.98, pointsRewardRate: 1.00, birthdayGift: '生日当月享8折优惠一次',       couponValue:  5, accentColor: '#8fc5fe' },
  { levelKey: 'rose_gold', name: '玫瑰金会员', levelIndex: 3, minSpent:  1000, discountRate: 0.95, pointsRewardRate: 1.20, birthdayGift: '生日当月享7折优惠+专属礼物',  couponValue: 10, accentColor: '#ada1f0' },
  { levelKey: 'platinum',  name: '铂金会员',   levelIndex: 4, minSpent:  3000, discountRate: 0.90, pointsRewardRate: 1.50, birthdayGift: '生日当月享6折优惠+上门配送',  couponValue: 20, accentColor: '#f8b95c' },
  { levelKey: 'diamond',   name: '钻石会员',   levelIndex: 5, minSpent: 10000, discountRate: 0.85, pointsRewardRate: 2.00, birthdayGift: '生日当月享5折优惠+专属客服',  couponValue: 50, accentColor: '#ee6155' },
];

async function loadTiers() {
  try {
    if (_cache && Date.now() - _cacheTime < CACHE_TTL) return _cache;
    _cache = await memberTierService.getActive();
    if (_cache && _cache.length > 0) {
      _cacheTime = Date.now();
      return _cache;
    }
  } catch (_) { /* fall through to fallback */ }
  return FALLBACK_TIERS;
}

// ── 缓存刷新（管理后台修改等级后调用）───────────
function invalidateCache() {
  _cache = null;
  _cacheTime = 0;
}

async function computeTier(totalSpent) {
  const tiers = await loadTiers();
  const spent = parseFloat(totalSpent || 0);
  let tier = tiers[0];
  for (let i = tiers.length - 1; i >= 0; i--) {
    if (spent >= tiers[i].minSpent) {
      tier = tiers[i];
      break;
    }
  }
  const tierIndex = tiers.findIndex(t => t.levelKey === tier.levelKey);
  const isMax = tierIndex === tiers.length - 1;
  const nextTier = isMax ? null : tiers[tierIndex + 1];
  const spentToNext = isMax ? 0 : nextTier.minSpent - spent;
  const tierProgress = isMax ? 100
    : Math.min(100, Math.round(((spent - tier.minSpent) / (nextTier.minSpent - tier.minSpent)) * 100));

  return {
    ...tier,
    tierIndex,
    isMax,
    totalSpent: spent,
    spentToNext,
    tierProgress,
  };
}

async function getTierLevel(totalSpent) {
  const { levelKey } = await computeTier(totalSpent);
  return levelKey;
}

module.exports = { loadTiers, computeTier, getTierLevel, invalidateCache };
