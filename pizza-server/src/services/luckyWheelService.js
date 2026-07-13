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

/** Today's draw counts for a user. `billable` = non-'again' & non-'bonus' rows → gates
 *  the daily ceiling (maxPerDay); `freeCnt` = source='free' rows → gates the free sub-quota.
 *  "再来一次" wins (source='again') and bonus re-spins (source='bonus') count toward NEITHER. */
async function todayCounts(conn, userId) {
  const [[row]] = await conn.query(
    `SELECT COALESCE(SUM(CASE WHEN source NOT IN ('again','bonus') THEN 1 ELSE 0 END), 0) AS billable,
            COALESCE(SUM(CASE WHEN source = 'free' THEN 1 ELSE 0 END), 0) AS freeCnt
       FROM lucky_wheel_draws
      WHERE user_id = ? AND DATE(created_at) = CURDATE()`,
    [userId]
  );
  return { billable: Number(row.billable), freeCnt: Number(row.freeCnt) };
}

/** Wheel config for the front-end. NEVER exposes weight/stock. */
async function getWheelConfig(userId) {
  const cfg = await getLuckyConfig();
  const [prizes] = await pool.query(
    'SELECT id, type, name, color, icon FROM lucky_wheel_prizes WHERE is_active = 1 ORDER BY sort_order, id'
  );
  const [[counts]] = await pool.query(
    `SELECT COALESCE(SUM(CASE WHEN source NOT IN ('again','bonus') THEN 1 ELSE 0 END), 0) AS billable,
            COALESCE(SUM(CASE WHEN source = 'free' THEN 1 ELSE 0 END), 0) AS freeCnt
       FROM lucky_wheel_draws WHERE user_id = ? AND DATE(created_at) = CURDATE()`,
    [userId]
  );
  const [[u]] = await pool.query('SELECT points FROM users WHERE id = ?', [userId]);
  const billable = Number(counts.billable);
  const freeCnt = Number(counts.freeCnt);
  const freeRemaining = Math.max(0, cfg.freePerDay - freeCnt);
  const drawsRemaining = Math.max(0, cfg.maxPerDay - billable); // 'again' re-spins excluded from the ceiling
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

    // Daily ledger gates. `billable` excludes 'again' re-spins from the ceiling.
    const { billable, freeCnt } = await todayCounts(conn, userId);
    if (billable >= cfg.maxPerDay) { await conn.rollback(); return { error: '今日抽奖次数已达上限', reason: 'reach_max' }; }

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

    // "再来一次" is a free re-spin: recorded as 'again', costs nothing,
    // counts toward NEITHER the free sub-quota NOR the daily billable ceiling.
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
        // Refund the stock unit burned by the pick-time CAS: a finite-stock coupon prize
        // incremented awarded_count when picked, but is degrading to 'thanks', so give the unit
        // back — a misconfigured prize must not silently exhaust its stock. Unlimited-stock prizes
        // (stock == null) were taken without incrementing, so they are skipped. Same tx, row still locked.
        if (prize.stock != null) {
          await conn.query('UPDATE lucky_wheel_prizes SET awarded_count = awarded_count - 1 WHERE id = ?', [prize.id]);
        }
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
    // 'again' is a free re-spin — it does NOT advance the daily ceiling.
    const newBillable = isAgain ? billable : billable + 1;
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
      drawsRemaining: Math.max(0, cfg2.maxPerDay - newBillable),
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

// ───────────────────────── Admin ─────────────────────────

function formatPrize(r) {
  return {
    id: r.id,
    type: r.type,
    name: r.name,
    weight: r.weight,
    stock: r.stock,
    awardedCount: r.awarded_count,
    couponTemplateId: r.coupon_template_id,
    pointsAmount: r.points_amount,
    balanceAmount: r.balance_amount,
    color: r.color,
    icon: r.icon,
    sortOrder: r.sort_order,
    isActive: !!r.is_active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

async function adminListPrizes() {
  const [rows] = await pool.query('SELECT * FROM lucky_wheel_prizes ORDER BY sort_order, id');
  return rows.map(formatPrize);
}

async function adminGetPrize(id) {
  const [[row]] = await pool.query('SELECT * FROM lucky_wheel_prizes WHERE id = ?', [id]);
  return row ? formatPrize(row) : null;
}

async function adminCreatePrize(d) {
  const [r] = await pool.query(
    `INSERT INTO lucky_wheel_prizes
       (type, name, weight, stock, coupon_template_id, points_amount, balance_amount, color, icon, sort_order, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      d.type, d.name, d.weight ?? 1, d.stock ?? null,
      d.couponTemplateId ?? null, d.pointsAmount ?? null, d.balanceAmount ?? null,
      d.color ?? '#F5C518', d.icon ?? '', d.sortOrder ?? 0,
      d.isActive === false ? 0 : 1,
    ]
  );
  return { id: r.insertId };
}

async function adminUpdatePrize(id, d) {
  const fields = [];
  const vals = [];
  const map = {
    type: 'type', name: 'name', weight: 'weight', stock: 'stock',
    couponTemplateId: 'coupon_template_id', pointsAmount: 'points_amount',
    balanceAmount: 'balance_amount', color: 'color', icon: 'icon', sortOrder: 'sort_order',
  };
  for (const [k, col] of Object.entries(map)) {
    if (d[k] !== undefined) { fields.push(`${col} = ?`); vals.push(d[k]); }
  }
  if (d.isActive !== undefined) { fields.push('is_active = ?'); vals.push(d.isActive ? 1 : 0); }
  if (!fields.length) return false;
  vals.push(id);
  const [r] = await pool.query(`UPDATE lucky_wheel_prizes SET ${fields.join(', ')} WHERE id = ?`, vals);
  return r.affectedRows > 0;
}

async function adminDeletePrize(id) {
  // draws.prize_id is ON DELETE SET NULL → hard delete is safe (no errno 1451).
  const [r] = await pool.query('DELETE FROM lucky_wheel_prizes WHERE id = ?', [id]);
  return r.affectedRows > 0;
}

async function adminTogglePrize(id) {
  await pool.query('UPDATE lucky_wheel_prizes SET is_active = 1 - is_active WHERE id = ?', [id]);
  const [[row]] = await pool.query('SELECT is_active FROM lucky_wheel_prizes WHERE id = ?', [id]);
  return { isActive: row ? !!row.is_active : false };
}

async function adminListRecords(page = 1, limit = 20) {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (p - 1) * l;
  const [[c]] = await pool.query('SELECT COUNT(*) AS total FROM lucky_wheel_draws');
  const [rows] = await pool.query(
    `SELECT d.id, d.user_id AS userId, u.name AS userName, d.prize_type AS prizeType,
            d.prize_name AS prizeName, d.source, d.cost_points AS costPoints,
            d.coupon_id AS couponId, d.points_amount AS pointsAmount,
            d.balance_amount AS balanceAmount, d.created_at AS createdAt
       FROM lucky_wheel_draws d
       LEFT JOIN users u ON u.id = d.user_id
      ORDER BY d.id DESC LIMIT ? OFFSET ?`,
    [l, offset]
  );
  return { total: Number(c.total), list: rows };
}

async function adminGetLuckyConfig() {
  return getLuckyConfig();
}

async function saveLuckyConfig(d) {
  const entries = [
    ['lucky_enabled', d.enabled ? '1' : '0'],
    ['lucky_free_per_day', String(d.freePerDay)],
    ['lucky_points_cost', String(d.pointsCost)],
    ['lucky_max_per_day', String(d.maxPerDay)],
  ];
  for (const [key, val] of entries) {
    await pool.query(
      'INSERT INTO system_config (config_key, config_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE config_value = ?',
      [key, val, val]
    );
  }
  return getLuckyConfig();
}

module.exports = {
  getLuckyConfig, getWheelConfig, draw, myRecords,
  adminListPrizes, adminGetPrize, adminCreatePrize, adminUpdatePrize,
  adminDeletePrize, adminTogglePrize, adminListRecords,
  adminGetLuckyConfig, saveLuckyConfig,
};
