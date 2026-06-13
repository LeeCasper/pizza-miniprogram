const TIER_THRESHOLDS = [
  { key: 'normal',  name: '普通会员', threshold: 0,    icon: '⭐',   gradient: '#8E8E93 → #C8C8CC' },
  { key: 'gold',    name: '黄金会员', threshold: 1000,  icon: '🌟',  gradient: '#C4A01E → #E8C840' },
  { key: 'platinum',name: '铂金会员', threshold: 3000,  icon: '💎',  gradient: '#6366F1 → #8B5CF6' },
  { key: 'diamond', name: '钻石会员', threshold: 6000,  icon: '👑',  gradient: '#1A1C1C → #303031' },
];

function computeTier(points) {
  let tier = TIER_THRESHOLDS[0];
  for (let i = TIER_THRESHOLDS.length - 1; i >= 0; i--) {
    if (points >= TIER_THRESHOLDS[i].threshold) {
      tier = TIER_THRESHOLDS[i];
      break;
    }
  }

  const tierIndex = TIER_THRESHOLDS.findIndex(t => t.key === tier.key);
  const isMax = tierIndex === TIER_THRESHOLDS.length - 1;
  const nextTier = isMax ? null : TIER_THRESHOLDS[tierIndex + 1];
  const pointsToNext = isMax ? 0 : nextTier.threshold - points;
  const tierProgress = isMax ? 100
    : Math.round(((points - tier.threshold) / (nextTier.threshold - tier.threshold)) * 100);

  return {
    tierKey: tier.key,
    tierName: tier.name,
    tierIcon: tier.icon,
    tierGradient: tier.gradient,
    tierIndex,
    isMax,
    pointsToNext,
    tierProgress,
  };
}

function getTierLevel(points) {
  const { tierKey } = computeTier(points);
  return tierKey;
}

module.exports = { TIER_THRESHOLDS, computeTier, getTierLevel };
