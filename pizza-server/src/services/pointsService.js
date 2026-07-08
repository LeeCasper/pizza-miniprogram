const pool = require('../config/database');

const pointsService = {
  async getProducts() {
    const [rows] = await pool.query(
      'SELECT * FROM points_products WHERE is_active = 1 ORDER BY points ASC'
    );
    return rows.map(formatProduct);
  },

  async getProduct(id) {
    const [rows] = await pool.query(
      'SELECT * FROM points_products WHERE id = ? AND is_active = 1',
      [id]
    );
    return rows[0] ? formatProduct(rows[0]) : null;
  },

  async getHistory(userId, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const [rows] = await pool.query(
      'SELECT * FROM points_history WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [userId, limit, offset]
    );
    return rows.map(r => ({
      id: r.id,
      userId: r.user_id,
      pointsChange: r.points_change,
      balanceAfter: r.balance_after,
      reason: r.reason,
      referenceId: r.reference_id,
      createdAt: r.created_at,
    }));
  },

  async addHistory(userId, pointsChange, balanceAfter, reason, referenceId = '') {
    await pool.query(
      'INSERT INTO points_history (user_id, points_change, balance_after, reason, reference_id) VALUES (?, ?, ?, ?, ?)',
      [userId, pointsChange, balanceAfter, reason, referenceId]
    );
  },

  // Admin
  async adminProducts() {
    const [rows] = await pool.query('SELECT * FROM points_products ORDER BY points ASC');
    return rows.map(formatProduct);
  },

  async createProduct(data) {
    const [result] = await pool.query(
      `INSERT INTO points_products (points_category_key, name, \`desc\`, detail_desc, points, image, stock, tag, highlights,
        redeem_type, coupon_name, coupon_category, coupon_value, coupon_discount_type,
        coupon_discount_value, coupon_min_spend, coupon_valid_days, use_tip)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [data.pointsCategoryKey || null, data.name, data.desc || '', data.detailDesc || '', data.points, data.image || '', data.stock ?? -1,
       data.tag || '', JSON.stringify(data.highlights || []),
       data.redeemType || 'coupon', data.couponName || '', data.couponCategory || 'redeem',
       data.couponValue || '', data.couponDiscountType || 'free_redeem',
       data.couponDiscountValue || '', data.couponMinSpend || 0, data.couponValidDays || 30,
       data.useTip || '']
    );
    return result.insertId;
  },

  async updateProduct(id, data) {
    const fields = ['points_category_key', 'name', 'desc', 'detail_desc', 'points', 'image', 'stock', 'tag', 'is_active',
      'redeem_type', 'coupon_name', 'coupon_category', 'coupon_value', 'coupon_discount_type',
      'coupon_discount_value', 'coupon_min_spend', 'coupon_valid_days', 'use_tip'];
    const sets = [];
    const values = [];
    for (const f of fields) {
      if (data[f] !== undefined) {
        sets.push(`\`${f}\` = ?`);
        values.push(data[f]);
      }
    }
    if (data.highlights !== undefined) {
      sets.push('highlights = ?');
      values.push(JSON.stringify(data.highlights));
    }
    if (sets.length === 0) return;
    values.push(id);
    await pool.query(`UPDATE points_products SET ${sets.join(', ')} WHERE id = ?`, values);
  },

  async softDelete(id) {
    await pool.query('UPDATE points_products SET is_active = 0 WHERE id = ?', [id]);
  },

  async toggle(id) {
    await pool.query('UPDATE points_products SET is_active = IF(is_active, 0, 1) WHERE id = ?', [id]);
  },
};

function formatProduct(row) {
  return {
    id: row.id,
    pointsCategoryKey: row.points_category_key || null,
    name: row.name,
    desc: row.desc,
    detailDesc: row.detail_desc,
    points: row.points,
    image: row.image,
    stock: row.stock,
    tag: row.tag,
    highlights: safeJson(row.highlights, []),
    redeemType: row.redeem_type,
    couponName: row.coupon_name,
    couponCategory: row.coupon_category,
    couponValue: row.coupon_value,
    couponDiscountType: row.coupon_discount_type,
    couponDiscountValue: row.coupon_discount_value,
    couponMinSpend: parseFloat(row.coupon_min_spend || 0),
    couponValidDays: row.coupon_valid_days,
    useTip: row.use_tip,
    isActive: !!row.is_active,
  };
}

function safeJson(val, defaultVal) {
  if (!val) return defaultVal;
  try { return typeof val === 'string' ? JSON.parse(val) : val; } catch (_) { return defaultVal; }
}

module.exports = pointsService;
