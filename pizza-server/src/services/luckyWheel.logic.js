'use strict';

/**
 * Pure lottery logic — no DB, no side effects. Unit-tested via node:test.
 * Prize shape here uses snake_case DB column names (rows from lucky_wheel_prizes).
 */

/** Keep only active prizes that still have stock (null stock = unlimited). */
function eligiblePrizes(prizes) {
  return prizes.filter(p => p.is_active && (p.stock == null || p.awarded_count < p.stock));
}

/** Weighted random pick. rand() injectable for tests. Returns null if no positive weight. */
function pickWeightedPrize(prizes, rand = Math.random) {
  if (!prizes.length) return null;
  const w = p => Math.max(0, Number(p.weight) || 0);
  const total = prizes.reduce((s, p) => s + w(p), 0);
  if (total <= 0) return null;
  let r = rand() * total;
  for (const p of prizes) {
    r -= w(p);
    if (r < 0) return p;
  }
  return prizes[prizes.length - 1]; // float-rounding guard
}

/** Human-readable award text. type may be downgraded to 'thanks' by the caller. */
function computeAwardText(prize) {
  switch (prize.type) {
    case 'coupon':  return `获得优惠券：${prize.name}`;
    case 'points':  return `获得 ${prize.points_amount || 0} 积分`;
    case 'balance': return `获得余额 ¥${Number(prize.balance_amount || 0).toFixed(2)}`;
    case 'again':   return '再来一次！';
    default:        return '谢谢参与';
  }
}

module.exports = { eligiblePrizes, pickWeightedPrize, computeAwardText };
