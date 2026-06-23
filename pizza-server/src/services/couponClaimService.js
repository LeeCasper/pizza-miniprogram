const pool = require('../config/database');
const { computeTier, loadTiers } = require('../utils/memberTier');

// ISO 周键 'YYYY-Www'（周一为周首）
function isoWeekKey(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function computePeriodKey(claimPeriod, date = new Date()) {
  if (claimPeriod === 'weekly') return isoWeekKey(date);
  if (claimPeriod === 'monthly') return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  return '';
}

// 由模板派生一张 coupons 行（事务内调用）。tpl 为 camelCase 模板对象。
async function mintCouponFromTemplate(conn, tpl, userId, source) {
  const now = new Date();
  const validFrom = now.toISOString().slice(0, 10);
  const validTo = new Date(now.getTime() + (tpl.validDays || 30) * 86400000).toISOString().slice(0, 10);
  const code = `CPN-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const [result] = await conn.query(
    `INSERT INTO coupons
       (user_id, template_id, name, \`desc\`, category, \`value\`, status, code,
        discount_type, discount_value, min_spend, max_discount, valid_from, valid_to, use_tip, color, source,
        redeem_product_name, redeem_product_price, redeem_product_image)
     VALUES (?, ?, ?, ?, ?, ?, 'available', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
             ?, ?, ?)`,
    [userId, tpl.id, tpl.name, tpl.desc || '', tpl.category, tpl.value || '', code,
     tpl.discountType, tpl.discountValue || '', tpl.minSpend || 0,
     tpl.maxDiscount == null ? null : tpl.maxDiscount,
     validFrom, validTo, tpl.useTip || '', tpl.color || '#D32F2F', source,
     tpl.redeemProductName || '', tpl.redeemProductPrice ?? null, tpl.redeemProductImage || '']
  );
  return result.insertId;
}

// 把 FOR UPDATE 锁到的 snake 行转成 mint 所需 camel 形状
function rowToTpl(t) {
  return {
    id: t.id, name: t.name, desc: t.desc, category: t.category, value: t.value,
    discountType: t.discount_type, discountValue: t.discount_value,
    minSpend: t.min_spend, maxDiscount: t.max_discount, validDays: t.valid_days,
    useTip: t.use_tip, color: t.color,
    redeemProductName: t.redeem_product_name || '',
    redeemProductPrice: t.redeem_product_price,
    redeemProductImage: t.redeem_product_image || '',
  };
}

async function userLevelIndex(totalSpent, memberLevel) {
  const tiers = await loadTiers();
  if (memberLevel) {
    const t = tiers.find(x => x.levelKey === memberLevel);
    if (t) return t.levelIndex || 0;
  }
  const tier = await computeTier(parseFloat(totalSpent || 0));
  return tier.levelIndex || 0;
}

const couponClaimService = {
  computePeriodKey,
  mintCouponFromTemplate,

  async listClaimable(userId) {
    const [tpls] = await pool.query(
      'SELECT * FROM coupon_templates WHERE is_active = 1 AND claimable = 1 ORDER BY id DESC'
    );
    const [[u]] = await pool.query('SELECT total_spent, member_level FROM users WHERE id = ?', [userId]);
    const level = await userLevelIndex(u ? u.total_spent : 0, u ? u.member_level : null);
    const out = [];
    for (const t of tpls) {
      const periodKey = computePeriodKey(t.claim_period);
      const [[{ cnt }]] = await pool.query(
        'SELECT COUNT(*) AS cnt FROM coupon_claims WHERE template_id = ? AND user_id = ? AND period_key = ?',
        [t.id, userId, periodKey]
      );
      const remainingStock = t.total_stock == null ? null : Math.max(0, t.total_stock - t.claimed_count);
      let canClaim = true; let reason = 'ok';
      if (level < t.min_member_level) { canClaim = false; reason = 'level_too_low'; }
      else if (cnt >= t.per_user_limit) { canClaim = false; reason = 'reach_limit'; }
      else if (remainingStock !== null && remainingStock <= 0) { canClaim = false; reason = 'out_of_stock'; }
      out.push({
        id: t.id, name: t.name, desc: t.desc, category: t.category, value: t.value,
        discountType: t.discount_type, discountValue: t.discount_value,
        minSpend: parseFloat(t.min_spend || 0),
        maxDiscount: t.max_discount == null ? null : parseFloat(t.max_discount),
        validDays: t.valid_days, color: t.color, useTip: t.use_tip,
        claimPeriod: t.claim_period, perUserLimit: t.per_user_limit, minMemberLevel: t.min_member_level,
        remainingStock, claimedInPeriod: cnt, canClaim, reason,
      });
    }
    return out;
  },

  async claim(userId, templateId) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [rows] = await conn.query('SELECT * FROM coupon_templates WHERE id = ? FOR UPDATE', [templateId]);
      const t = rows[0];
      if (!t || !t.is_active || !t.claimable) {
        await conn.rollback();
        return { error: '该优惠券不可领取', reason: 'not_claimable' };
      }
      const [[u]] = await conn.query('SELECT total_spent, member_level FROM users WHERE id = ?', [userId]);
      const level = await userLevelIndex(u ? u.total_spent : 0, u ? u.member_level : null);
      if (level < t.min_member_level) {
        await conn.rollback();
        return { error: '会员等级不足，无法领取', reason: 'level_too_low' };
      }
      const periodKey = computePeriodKey(t.claim_period);
      const [[{ cnt }]] = await conn.query(
        'SELECT COUNT(*) AS cnt FROM coupon_claims WHERE template_id = ? AND user_id = ? AND period_key = ?',
        [templateId, userId, periodKey]
      );
      if (cnt >= t.per_user_limit) {
        await conn.rollback();
        return { error: t.claim_period === 'none' ? '已达领取上限' : '本周期已领取', reason: 'reach_limit' };
      }
      if (t.total_stock != null) {
        const [upd] = await conn.query(
          'UPDATE coupon_templates SET claimed_count = claimed_count + 1 WHERE id = ? AND claimed_count < total_stock',
          [templateId]
        );
        if (upd.affectedRows === 0) {
          await conn.rollback();
          return { error: '已被领完', reason: 'out_of_stock' };
        }
      } else {
        await conn.query('UPDATE coupon_templates SET claimed_count = claimed_count + 1 WHERE id = ?', [templateId]);
      }
      const couponId = await mintCouponFromTemplate(conn, rowToTpl(t), userId, 'claim');
      await conn.query(
        'INSERT INTO coupon_claims (template_id, user_id, coupon_id, period_key) VALUES (?, ?, ?, ?)',
        [templateId, userId, couponId, periodKey]
      );
      await conn.commit();
      return { couponId };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },
};

module.exports = couponClaimService;
