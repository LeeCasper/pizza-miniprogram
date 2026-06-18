const pool = require('../config/database');
const { validateTransition } = require('../utils/orderStateMachine');
const auditService = require('./auditService');

const orderService = {
  async findByUser(userId, status, page = 1, limit = 10, paymentStatus) {
    let sql = 'SELECT * FROM orders WHERE user_id = ?';
    const params = [userId];
    if (status && status !== 'all') {
      sql += ' AND status = ?';
      params.push(status);
    }
    if (paymentStatus === 'paid') {
      sql += ' AND payment_method IS NOT NULL';
    } else if (paymentStatus === 'unpaid') {
      sql += ' AND payment_method IS NULL';
    }
    sql += ' ORDER BY created_at DESC';

    const offset = (page - 1) * limit;
    sql += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await pool.query(sql, params);
    const cancelMinutes = require('../config').business.orderCancelMinutes;
    return rows.map(r => formatOrder(r, cancelMinutes));
  },

  async findById(orderId) {
    const [rows] = await pool.query('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (!rows[0]) return null;
    const items = await this.getOrderItems(orderId);
    const cancelMinutes = require('../config').business.orderCancelMinutes;
    return { ...formatOrder(rows[0], cancelMinutes), items };
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
      "UPDATE orders SET status = 'cancelled', updated_at = NOW() WHERE id = ? AND user_id = ? AND status IN ('waiting', 'preparing')",
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
  async adminList({ status, paymentStatus, page = 1, limit = 20 }) {
    let sql = 'SELECT o.*, u.name AS user_name FROM orders o JOIN users u ON o.user_id = u.id';
    const conditions = [];
    const params = [];
    if (status && status !== 'all') {
      conditions.push('o.status = ?');
      params.push(status);
    }
    if (paymentStatus === 'paid') {
      conditions.push('o.payment_method IS NOT NULL');
    } else if (paymentStatus === 'unpaid') {
      conditions.push('o.payment_method IS NULL');
    }
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY o.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, (page - 1) * limit);

    const [rows] = await pool.query(sql, params);
    return rows.map(r => formatOrder(r, null)); // null = admin, no cancel time limit
  },

  async adminUpdateStatus(orderId, status, adminUser) {
    // Fetch current order to validate transition
    const [rows] = await pool.query('SELECT * FROM orders WHERE id = ?', [orderId]);
    const order = rows[0];
    if (!order) {
      const err = new Error('订单不存在');
      err.statusCode = 404;
      throw err;
    }

    // Validate state transition
    const check = validateTransition(order.status, status, order);
    if (!check.valid) {
      const err = new Error(check.reason);
      err.statusCode = 400;
      err.code = 'INVALID_TRANSITION';
      throw err;
    }

    const oldStatus = order.status;
    await pool.query('UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?', [status, orderId]);

    // Audit log
    await auditService.record({
      actorType: 'admin',
      actorId: adminUser ? adminUser.id : null,
      action: 'order.status_change',
      entityType: 'order',
      entityId: orderId,
      before: { status: oldStatus },
      after: { status },
    });

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
    const [todayRevenue] = await pool.query(
      "SELECT COALESCE(SUM(paid_amount), 0) AS total FROM orders WHERE payment_method IS NOT NULL AND DATE(paid_at) = CURDATE()"
    );
    const [todayOrdersPaid] = await pool.query(
      "SELECT COUNT(*) AS count FROM orders WHERE payment_method IS NOT NULL AND DATE(paid_at) = CURDATE()"
    );
    const [pendingPayments] = await pool.query(
      "SELECT COUNT(*) AS count FROM orders WHERE payment_method IS NULL AND status != 'cancelled'"
    );
    const [rechargeRevenue] = await pool.query(
      "SELECT COALESCE(SUM(amount), 0) AS total FROM payment_records WHERE type = 'recharge' AND status = 'success' AND DATE(updated_at) = CURDATE()"
    );
    const [rechargeCount] = await pool.query(
      "SELECT COUNT(*) AS count FROM payment_records WHERE type = 'recharge' AND status = 'success' AND DATE(updated_at) = CURDATE()"
    );
    return {
      todayOrders: todayOrders[0].count,
      totalUsers: totalUsers[0].count,
      activeCoupons: activeCoupons[0].count,
      todayRevenue: parseFloat(todayRevenue[0].total),
      todayOrdersPaid: todayOrdersPaid[0].count,
      pendingPayments: pendingPayments[0].count,
      rechargeRevenue: parseFloat(rechargeRevenue[0].total),
      rechargeCount: rechargeCount[0].count,
    };
  },
};

function formatOrder(row, cancelMinutes) {
  if (!row) return null;
  const base = {
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
    paymentMethod: row.payment_method || null,
    transactionId: row.transaction_id || null,
    paidAt: row.paid_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  // Cancel eligibility (only for user-facing queries where cancelMinutes is provided)
  if (cancelMinutes != null && (base.status === 'waiting' || base.status === 'preparing')) {
    const deadline = new Date(new Date(base.createdAt).getTime() + cancelMinutes * 60000);
    base.cancelDeadline = deadline.toISOString();
    base.canCancel = new Date() < deadline;
  } else {
    base.cancelDeadline = null;
    base.canCancel = false;
  }

  return base;
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
