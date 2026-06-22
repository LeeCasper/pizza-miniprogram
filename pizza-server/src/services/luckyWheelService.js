'use strict';

const pool = require('../config/database');
const couponTemplateService = require('./couponTemplateService');
const { mintCouponFromTemplate } = require('./couponClaimService');
const { eligiblePrizes, pickWeightedPrize, computeAwardText } = require('./luckyWheel.logic');
const { createLogger } = require('../utils/logger');

const log = createLogger('LuckyWheel');

const CONFIG_KEYS = ['lucky_enabled', 'lucky_free_per_day', 'lucky_points_cost', 'lucky_max_per_day'];
const CONFIG_DEFAULTS = { enabled: true, freePerDay: 1, pointsCost: 50, maxPerDay: 10 };

/** Read the 4 lucky_* config keys straight from system_config (cheap indexed read, per-draw). */
async function getLuckyConfig() {
  const [rows] = await pool.query(
    'SELECT config_key, config_value FROM system_config WHERE config_key IN (?, ?, ?, ?)',
    CONFIG_KEYS
  );
  const map = {};
  for (const r of rows) map[r.config_key] = r.config_value;
  return {
    enabled: map.lucky_enabled != null ? map.lucky_enabled === '1' : CONFIG_DEFAULTS.enabled,
    freePerDay: map.lucky_free_per_day != null ? parseInt(map.lucky_free_per_day, 10) : CONFIG_DEFAULTS.freePerDay,
    pointsCost: map.lucky_points_cost != null ? parseInt(map.lucky_points_cost, 10) : CONFIG_DEFAULTS.pointsCost,
    maxPerDay: map.lucky_max_per_day != null ? parseInt(map.lucky_max_per_day, 10) : CONFIG_DEFAULTS.maxPerDay,
  };
}

/** Today's draw counts for a user: total rows + free-source rows (gates entitlements). */
async function todayCounts(conn, userId) {
  const [[row]] = await conn.query(
    `SELECT COUNT(*) AS total,
            COALESCE(SUM(source = 'free'), 0) AS freeCnt
       FROM lucky_wheel_draws
      WHERE user_id = ? AND DATE(created_at) = CURDATE()`,
    [userId]
  );
  return { total: Number(row.total), freeCnt: Number(row.freeCnt) };
}

/** Wheel config for the front-end. NEVER exposes weight/stock. */
async function getWheelConfig(userId) {
  const cfg = await getLuckyConfig();
  const [prizes] = await pool.query(
    'SELECT id, type, name, color, icon FROM lucky_wheel_prizes WHERE is_active = 1 ORDER BY sort_order, id'
  );
  const [[counts]] = await pool.query(
    `SELECT COUNT(*) AS total, COALESCE(SUM(source = 'free'), 0) AS freeCnt
       FROM lucky_wheel_draws WHERE user_id = ? AND DATE(created_at) = CURDATE()`,
    [userId]
  );
  const [[u]] = await pool.query('SELECT points FROM users WHERE id = ?', [userId]);
  const total = Number(counts.total);
  const freeCnt = Number(counts.freeCnt);
  const freeRemaining = Math.max(0, cfg.freePerDay - freeCnt);
  const drawsRemaining = Math.max(0, cfg.maxPerDay - total);
  return {
    enabled: cfg.enabled,
    pointsCost: cfg.pointsCost,
    freeRemaining,
    drawsRemaining,
    userPoints: u ? Number(u.points) : 0,
    segments: prizes.map(p => ({ id: p.id, type: p.type, name: p.name, color: p.color, icon: p.icon })),
  };
}

/**
 * Perform one draw. source ∈ {'free','points'}.
 * Returns the award descriptor, OR { error, reason } for expected business failures.
 * The outcome AND the award are decided/applied inside one transaction.
 */
async function draw(userId, source) {
  const cfg = await getLuckyConfig();
  if (!cfg.enabled) return { error: '幸运转盘暂未开放', reason: 'disabled' };

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Lock the user row (points balance) for the whole draw.
    const [[u]] = await conn.query('SELECT id, points FROM users WHERE id = ? FOR UPDATE', [userId]);
    if (!u) { await conn.rollback(); return { error: '用户不存在', reason: 'no_user' }; }

    // Daily ledger gates.
    const { total, freeCnt } = await todayCounts(conn, userId);
    if (total >= cfg.maxPerDay) { await conn.rollback(); return { error: '今日抽奖次数已达上限', reason: 'reach_max' }; }

    let cost = 0;
    if (source === 'free') {
      if (freeCnt >= cfg.freePerDay) { await conn.rollback(); return { error: '今日免费次数已用完', reason: 'no_free' }; }
    } else { // 'points'
      cost = cfg.pointsCost;
      if (Number(u.points) < cost) { await conn.rollback(); return { error: '积分不足', reason: 'no_points' }; }
    }

    // Load active prizes locked, then weighted-pick with CAS stock decrement.
    const [allPrizes] = await conn.query(
      'SELECT * FROM lucky_wheel_prizes WHERE is_active = 1 ORDER BY sort_order, id FOR UPDATE'
    );
    let pool2 = eligiblePrizes(allPrizes);
    let prize = null;
    while (pool2.length) {
      const pick = pickWeightedPrize(pool2);
      if (!pick) break;
      if (pick.stock == null) { prize = pick; break; } // unlimited → take
      const [upd] = await conn.query(
        'UPDATE lucky_wheel_prizes SET awarded_count = awarded_count + 1 WHERE id = ? AND awarded_count < stock',
        [pick.id]
      );
      if (upd.affectedRows === 1) { prize = pick; break; } // won the stock race
      pool2 = pool2.filter(p => p.id !== pick.id);          // lost / sold out → drop & repick
    }
    if (!prize) { await conn.rollback(); return { error: '今日奖品已抽完', reason: 'no_prize' }; }

    // "再来一次" refunds the entitlement: recorded as 'again', costs nothing,
    // does NOT consume the free sub-quota but DOES count toward the hard daily ceiling.
    const isAgain = prize.type === 'again';
    const recordedSource = isAgain ? 'again' : source;
    const effectiveCost = isAgain ? 0 : cost;

    // Deduct points if this was a paid (non-again) draw.
    let userPoints = Number(u.points);
    if (effectiveCost > 0) {
      userPoints -= effectiveCost;
      await conn.query('UPDATE users SET points = ? WHERE id = ?', [userPoints, userId]);
      await conn.query(
        'INSERT INTO points_history (user_id, points_change, balance_after, reason, reference_id) VALUES (?, ?, ?, ?, ?)',
        [userId, -effectiveCost, userPoints, '幸运转盘加抽', '']
      );
    }

    // Award branch. resultType may be downgraded coupon→thanks if template is gone.
    let resultType = prize.type;
    let couponId = null;
    let pointsAwarded = null;
    let balanceAmount = null;

    if (prize.type === 'coupon') {
      const tpl = await couponTemplateService.findById(prize.coupon_template_id);
      if (!tpl || !tpl.isActive) {
        resultType = 'thanks'; // graceful degrade — never fail the draw on a misconfigured prize
        log.warn({ prizeId: prize.id, tplId: prize.coupon_template_id }, 'coupon prize template missing/inactive — degraded to thanks');
      } else {
        couponId = await mintCouponFromTemplate(conn, tpl, userId, 'lucky_wheel');
      }
    } else if (prize.type === 'points') {
      pointsAwarded = Number(prize.points_amount || 0);
      if (pointsAwarded > 0) {
        userPoints += pointsAwarded;
        await conn.query('UPDATE users SET points = ? WHERE id = ?', [userPoints, userId]);
        await conn.query(
          'INSERT INTO points_history (user_id, points_change, balance_after, reason, reference_id) VALUES (?, ?, ?, ?, ?)',
          [userId, pointsAwarded, userPoints, '幸运转盘中奖', '']
        );
      }
    } else if (prize.type === 'balance') {
      balanceAmount = Number(prize.balance_amount || 0);
      if (balanceAmount > 0) {
        const [[bRow]] = await conn.query('SELECT balance FROM users WHERE id = ? FOR UPDATE', [userId]);
        const newBalance = Number(bRow.balance) + balanceAmount;
        await conn.query('UPDATE users SET balance = ? WHERE id = ?', [newBalance, userId]);
        await conn.query(
          'INSERT INTO balance_history (user_id, amount, balance_after, type, remark) VALUES (?, ?, ?, ?, ?)',
          [userId, balanceAmount, newBalance, 'reward', '幸运转盘中奖']
        );
      }
    }
    // 'thanks' and 'again' award nothing material.

    // Snapshot the draw into the ledger.
    await conn.query(
      `INSERT INTO lucky_wheel_draws
         (user_id, prize_id, prize_type, prize_name, source, cost_points, coupon_id, points_amount, balance_amount)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, prize.id, resultType, prize.name, recordedSource, effectiveCost, couponId, pointsAwarded, balanceAmount]
    );

    await conn.commit();

    // Post-commit: recompute remaining for the response.
    const cfg2 = cfg; // unchanged within request
    const newTotal = total + 1;
    const newFree = recordedSource === 'free' ? freeCnt + 1 : freeCnt;
    return {
      prizeId: prize.id,
      type: resultType,
      name: prize.name,
      awardText: computeAwardText({ type: resultType, name: prize.name, points_amount: pointsAwarded, balance_amount: balanceAmount }),
      bonusSpin: isAgain,
      userPoints,
      balanceText: balanceAmount != null ? `¥${balanceAmount.toFixed(2)}` : null,
      freeRemaining: Math.max(0, cfg2.freePerDay - newFree),
      drawsRemaining: Math.max(0, cfg2.maxPerDay - newTotal),
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/** Paginated draw records for the current user. */
async function myRecords(userId, page = 1, limit = 20) {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (p - 1) * l;
  const [[c]] = await pool.query('SELECT COUNT(*) AS total FROM lucky_wheel_draws WHERE user_id = ?', [userId]);
  const [rows] = await pool.query(
    `SELECT id, prize_type, prize_name, source, cost_points, points_amount, balance_amount, created_at
       FROM lucky_wheel_draws WHERE user_id = ? ORDER BY id DESC LIMIT ? OFFSET ?`,
    [userId, l, offset]
  );
  return {
    total: Number(c.total),
    list: rows.map(r => ({
      id: r.id,
      prizeType: r.prize_type,
      prizeName: r.prize_name,
      source: r.source,
      costPoints: r.cost_points,
      pointsAmount: r.points_amount,
      balanceAmount: r.balance_amount,
      createdAt: r.created_at,
    })),
  };
}

module.exports = { getLuckyConfig, getWheelConfig, draw, myRecords };
