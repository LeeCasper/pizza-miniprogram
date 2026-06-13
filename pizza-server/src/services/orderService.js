const pool = require('../config/database');

const orderService = {
  async findByUser(userId, status, page = 1, limit = 10) {
    let sql = 'SELECT * FROM orders WHERE user_id = ?';
    const params = [userId];
    if (status && status !== 'all') {
      sql += ' AND status = ?';
      params.push(status);
    }
    sql += ' ORDER BY created_at DESC';

    const offset = (page - 1) * limit;
    sql += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await pool.query(sql, params);
    return rows.map(formatOrder);
  },

  async findById(orderId) {
    const [rows] = await pool.query('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (!rows[0]) return null;
    const items = await this.getOrderItems(orderId);
    return { ...formatOrder(rows[0]), items };
  },

  async getOrderItems(orderId) {
    const [rows] = await pool.query(
      'SELECT * FROM order_items WHERE order_id = ?',
      [orderId]
    );
    return rows.map(formatOrderItem);
  },

  async create(data) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // 1. Insert order
      await conn.query(
        `INSERT INTO orders (id, user_id, status, total, discount_amount, paid_amount, pickup_code, store_name, coupon_used_id, note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [data.id, data.userId, data.status, data.total, data.discountAmount, data.paidAmount,
         data.pickupCode, data.storeName, data.couponUsedId || null, data.note || '']
      );

      // 2. Insert order items
      for (const item of data.items) {
        await conn.query(
          `INSERT INTO order_items (order_id, product_id, product_name, price, quantity, restrictions)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [data.id, item.productId, item.productName, item.price, item.quantity,
           JSON.stringify(item.restrictions || [])]
        );
      }

      await conn.commit();
      return this.findById(data.id);
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  async cancel(orderId, userId) {
    const [result] = await pool.query(
      "UPDATE orders SET status = 'cancelled', updated_at = NOW() WHERE id = ? AND user_id = ? AND status = 'waiting'",
      [orderId, userId]
    );
    if (result.affectedRows === 0) {
      return null;
    }
    return this.findById(orderId);
  },

  async getTodayMaxSeq(datePrefix) {
    const [rows] = await pool.query(
      "SELECT MAX(CAST(SUBSTRING(id, 9) AS UNSIGNED)) AS maxSeq FROM orders WHERE id LIKE ?",
      [`${datePrefix}%`]
    );
    return rows[0].maxSeq || 0;
  },

  async findPickupCodeToday(code) {
    const [rows] = await pool.query(
      "SELECT id FROM orders WHERE pickup_code = ? AND DATE(created_at) = CURDATE()",
      [code]
    );
    return rows.length > 0;
  },

  // Admin
  async adminList({ status, page = 1, limit = 20 }) {
    let sql = 'SELECT o.*, u.name AS user_name FROM orders o JOIN users u ON o.user_id = u.id';
    const params = [];
    if (status && status !== 'all') {
      sql += ' WHERE o.status = ?';
      params.push(status);
    }
    sql += ' ORDER BY o.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, (page - 1) * limit);

    const [rows] = await pool.query(sql, params);
    return rows.map(formatOrder);
  },

  async adminUpdateStatus(orderId, status) {
    await pool.query('UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?', [status, orderId]);
    return this.findById(orderId);
  },

  async getDashboardStats() {
    const [todayOrders] = await pool.query(
      "SELECT COUNT(*) AS count FROM orders WHERE DATE(created_at) = CURDATE()"
    );
    const [totalUsers] = await pool.query('SELECT COUNT(*) AS count FROM users');
    const [activeCoupons] = await pool.query(
      "SELECT COUNT(*) AS count FROM coupons WHERE status = 'available' AND valid_to >= CURDATE()"
    );
    return {
      todayOrders: todayOrders[0].count,
      totalUsers: totalUsers[0].count,
      activeCoupons: activeCoupons[0].count,
    };
  },
};

function formatOrder(row) {
  return row ? {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name,
    status: row.status,
    total: parseFloat(row.total),
    discountAmount: parseFloat(row.discount_amount || 0),
    paidAmount: parseFloat(row.paid_amount || 0),
    pickupCode: row.pickup_code,
    storeName: row.store_name,
    couponUsedId: row.coupon_used_id,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  } : null;
}

function formatOrderItem(row) {
  return {
    id: row.id,
    orderId: row.order_id,
    productId: row.product_id,
    productName: row.product_name,
    price: parseFloat(row.price),
    quantity: row.quantity,
    restrictions: safeJson(row.restrictions, []),
  };
}

function safeJson(val, defaultVal) {
  if (!val) return defaultVal;
  try { return typeof val === 'string' ? JSON.parse(val) : val; } catch (_) { return defaultVal; }
}

module.exports = orderService;
