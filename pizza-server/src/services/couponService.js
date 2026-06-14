const pool = require('../config/database');

const couponService = {
  async findByUser(userId, category, status) {
    let sql = 'SELECT * FROM coupons WHERE user_id = ?';
    const params = [userId];
    if (category && category !== 'all') {
      sql += ' AND category = ?';
      params.push(category);
    }
    if (status && status !== 'all') {
      sql += ' AND status = ?';
      params.push(status);
    }
    sql += ' ORDER BY created_at DESC';
    const [rows] = await pool.query(sql, params);
    return rows.map(formatCoupon);
  },

  async findById(id, userId) {
    const [rows] = await pool.query(
      'SELECT * FROM coupons WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    return rows[0] ? formatCoupon(rows[0]) : null;
  },

  async findByCode(code) {
    const [rows] = await pool.query('SELECT * FROM coupons WHERE code = ?', [code]);
    return rows[0] ? formatCoupon(rows[0]) : null;
  },

  async use(id, userId) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const coupon = await this.findById(id, userId);
      if (!coupon) {
        await conn.rollback();
        return { error: '优惠券不存在' };
      }
      if (coupon.status !== 'available') {
        await conn.rollback();
        return { error: '优惠券不可用' };
      }
      const now = new Date();
      const validTo = new Date(coupon.validTo);
      if (validTo < now) {
        // Mark as expired
        await conn.query("UPDATE coupons SET status = 'expired' WHERE id = ?", [id]);
        await conn.commit();
        return { error: '优惠券已过期' };
      }

      await conn.query(
        "UPDATE coupons SET status = 'used', used_at = NOW() WHERE id = ?",
        [id]
      );
      await conn.commit();
      return { success: true };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  async create(data) {
    const {
      userId, name, desc, detailDesc, category, value, source, code,
      discountType, discountValue, minSpend,
      redeemProductName, redeemProductPrice, redeemProductImage,
      validFrom, validTo, useTip, color,
    } = data;
    const [result] = await pool.query(
      `INSERT INTO coupons (user_id, name, \`desc\`, detail_desc, category, \`value\`, source, status, code,
        discount_type, discount_value, min_spend,
        redeem_product_name, redeem_product_price, redeem_product_image,
        valid_from, valid_to, use_tip, color)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'available', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, name, desc || '', detailDesc || '', category, value || '', source || '', code,
       discountType || null, discountValue || '', minSpend || 0,
       redeemProductName || '', redeemProductPrice || null, redeemProductImage || '',
       validFrom, validTo, useTip || '', color || '#D32F2F']
    );
    return this.findById(result.insertId, userId);
  },

  async adminList({ status, category, page = 1, limit = 20 } = {}) {
    let sql = `SELECT c.*, u.name AS user_name FROM coupons c
               JOIN users u ON c.user_id = u.id`;
    const conditions = [];
    const params = [];
    if (status && status !== 'all') {
      conditions.push('c.status = ?');
      params.push(status);
    }
    if (category && category !== 'all') {
      conditions.push('c.category = ?');
      params.push(category);
    }
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY c.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, (page - 1) * limit);

    const [rows] = await pool.query(sql, params);
    return rows.map(formatCoupon);
  },

  async expireOverdue() {
    const [result] = await pool.query(
      "UPDATE coupons SET status = 'expired' WHERE status = 'available' AND valid_to < CURDATE()"
    );
    return result.affectedRows;
  },
};

function formatCoupon(row) {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    desc: row.desc,
    detailDesc: row.detail_desc,
    category: row.category,
    categoryLabel: row.category === 'redeem' ? '兑换券' : '优惠券',
    typeIcon: row.category === 'redeem' ? '🎫' : '🎟️',
    value: row.value,
    source: row.source,
    status: row.status,
    code: row.code,
    discountType: row.discount_type,
    discountValue: row.discount_value,
    minSpend: parseFloat(row.min_spend || 0),
    redeemProduct: row.redeem_product_name ? {
      name: row.redeem_product_name,
      price: row.redeem_product_price ? parseFloat(row.redeem_product_price) : 0,
      image: row.redeem_product_image,
    } : null,
    validFrom: row.valid_from,
    validTo: row.valid_to,
    usedAt: row.used_at,
    useTip: row.use_tip,
    color: row.color,
    createdAt: row.created_at,
  };
}

module.exports = couponService;
