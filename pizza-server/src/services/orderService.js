const pool = require('../config/database');
const { validateTransition } = require('../utils/orderStateMachine');
const { generatePickupCode } = require('../utils/pickupCode');
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
    const orders = rows.map(r => formatOrder(r, cancelMinutes));

    // 批量附带每单商品明细（用于订单卡展示商品图片/数量）。
    // order_items 无 image 列 → LEFT JOIN products 取图（商品被删则为空）。一次 IN 查询避免 N+1。
    if (orders.length) {
      const ids = orders.map(o => o.id);
      const placeholders = ids.map(() => '?').join(',');
      const [itemRows] = await pool.query(
        `SELECT oi.order_id, oi.product_name, oi.price, oi.quantity, p.image AS product_image
         FROM order_items oi
         LEFT JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id IN (${placeholders})`,
        ids
      );
      const byOrder = {};
      for (const it of itemRows) {
        (byOrder[it.order_id] || (byOrder[it.order_id] = [])).push({
          name: it.product_name,
          qty: it.quantity,
          price: parseFloat(it.price),
          image: it.product_image || '',
        });
      }
      orders.forEach(o => { o.items = byOrder[o.id] || []; });
    }

    return orders;
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

  /**
   * 使用兑换券生成订单（即时结算，支付方式=coupon）。
   * 从券所属模板解析真实在售商品以扣库存，并让订单列表缩略图经 products join 显示；
   * 无关联在售商品时降级为快照（product_id=NULL，不扣库存）。
   */
  async createRedeemOrder(userId, couponId) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // 1. 锁定并校验兑换券
      const [[coupon]] = await conn.query(
        'SELECT * FROM coupons WHERE id = ? AND user_id = ? FOR UPDATE',
        [couponId, userId]
      );
      if (!coupon) { await conn.rollback(); return { error: '兑换券不存在' }; }
      if (coupon.category !== 'redeem') { await conn.rollback(); return { error: '该券不是兑换券' }; }
      if (coupon.status !== 'available') { await conn.rollback(); return { error: '兑换券不可用' }; }
      // 过期：用 SQL 比较 CURDATE() 避免时区歧义
      const [[{ expired }]] = await conn.query(
        'SELECT (valid_to < CURDATE()) AS expired FROM coupons WHERE id = ?',
        [couponId]
      );
      if (expired) {
        await conn.query("UPDATE coupons SET status = 'expired' WHERE id = ?", [couponId]);
        await conn.commit();
        return { error: '兑换券已过期' };
      }

      // 2. 解析兑换商品 + 扣库存（仅当券所属模板关联了在售商品）
      let productId = null;
      const productName = coupon.redeem_product_name || '兑换商品';
      const value = coupon.redeem_product_price != null ? parseFloat(coupon.redeem_product_price) : 0;
      if (coupon.template_id) {
        const [[tpl]] = await conn.query(
          'SELECT product_id FROM coupon_templates WHERE id = ?',
          [coupon.template_id]
        );
        if (tpl && tpl.product_id) {
          const [[product]] = await conn.query(
            'SELECT id, stock FROM products WHERE id = ? AND is_deleted = 0 FOR UPDATE',
            [tpl.product_id]
          );
          if (product) {
            productId = product.id;
            if (product.stock >= 0) { // stock<0 视为不限量（沿用下单逻辑）
              if (product.stock < 1) { await conn.rollback(); return { error: '兑换商品库存不足' }; }
              await conn.query(
                'UPDATE products SET stock = stock - 1 WHERE id = ? AND stock >= 1',
                [product.id]
              );
            }
          }
        }
      }

      // 3. 订单号 + 取餐码
      const now = new Date();
      const orderId = await generateOrderId(conn, now);
      const pickupCode = await generateUniquePickupCode(conn);

      // 4. 插订单：合计=商品价值，实付0，支付方式=coupon（即时结算）
      await conn.query(
        `INSERT INTO orders (id, user_id, status, total, discount_amount, paid_amount, pickup_code, store_name, coupon_used_id, note, payment_method, paid_at)
         VALUES (?, ?, 'waiting', ?, ?, 0, ?, ?, ?, ?, 'coupon', ?)`,
        [orderId, userId, value.toFixed(2), value.toFixed(2), pickupCode,
         require('../config').business.storeName, couponId, '兑换券订单', now]
      );

      // 5. 插明细（数量固定 1）
      await conn.query(
        `INSERT INTO order_items (order_id, product_id, product_name, price, quantity, restrictions)
         VALUES (?, ?, ?, ?, 1, ?)`,
        [orderId, productId, productName, value.toFixed(2), JSON.stringify([])]
      );

      // 6. 标记兑换券已用
      await conn.query("UPDATE coupons SET status = 'used', used_at = NOW() WHERE id = ?", [couponId]);

      await conn.commit();

      // —— 事务外 best-effort：审计 + 即时打印（不阻断结果）——
      await auditService.record({
        actorType: 'user',
        actorId: userId,
        action: 'order.created',
        entityType: 'order',
        entityId: orderId,
        after: { total: value, paidAmount: 0, paymentMethod: 'coupon', via: 'redeem_coupon', pickupCode },
      });

      if (require('../config').printer.enabled) {
        const order = await this.findById(orderId);
        require('../services/printerService').printOrderTicket(order).catch(() => {});
      }

      return { success: true, orderId };
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

  async markPickedUp(orderId, userId) {
    const [result] = await pool.query(
      "UPDATE orders SET status = 'completed', updated_at = NOW() WHERE id = ? AND user_id = ? AND status = 'waiting'",
      [orderId, userId]
    );
    return result.affectedRows > 0;
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

  /** 仪表盘图表数据：7日订单趋势 + 订单状态分布 */
  async getDashboardCharts() {
    // 最近7天订单趋势（含今天）
    const [orderTrend] = await pool.query(
      `SELECT DATE(created_at) AS date,
              COUNT(*) AS orders,
              COALESCE(SUM(CASE WHEN payment_method IS NOT NULL THEN paid_amount ELSE 0 END), 0) AS revenue
       FROM orders
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
       GROUP BY DATE(created_at)
       ORDER BY date ASC`
    );

    // 订单状态分布（全部订单）
    const [statusDist] = await pool.query(
      `SELECT status, COUNT(*) AS count FROM orders GROUP BY status`
    );

    // 填充没有订单的日期为 0
    const trendMap = new Map();
    for (const row of orderTrend) {
      const d = row.date instanceof Date
        ? row.date.toISOString().slice(0, 10)
        : String(row.date).slice(0, 10);
      trendMap.set(d, { date: d, orders: row.orders, revenue: parseFloat(row.revenue) });
    }
    const trend = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      trend.push(trendMap.get(key) || { date: key, orders: 0, revenue: 0 });
    }

    return {
      orderTrend: trend,
      statusDistribution: statusDist.map(r => ({ status: r.status, count: r.count })),
    };
  },
};

// 事务内生成订单号：日期前缀 + 当日 3 位序号（与 orderController.create 同规则）
async function generateOrderId(conn, now) {
  const datePrefix = now.getFullYear().toString()
    + String(now.getMonth() + 1).padStart(2, '0')
    + String(now.getDate()).padStart(2, '0');
  const [rows] = await conn.query(
    "SELECT MAX(CAST(SUBSTRING(id, 9) AS UNSIGNED)) AS maxSeq FROM orders WHERE id LIKE ?",
    [`${datePrefix}%`]
  );
  return datePrefix + String((rows[0].maxSeq || 0) + 1).padStart(3, '0');
}

// 事务内生成当日唯一取餐码
async function generateUniquePickupCode(conn) {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const code = generatePickupCode();
    const [rows] = await conn.query(
      "SELECT id FROM orders WHERE pickup_code = ? AND DATE(created_at) = CURDATE()",
      [code]
    );
    if (rows.length === 0) return code;
  }
}

function formatOrder(row, cancelMinutes) {
  if (!row) return null;
  const base = {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name,
    status: row.status,
    total: parseFloat(row.total),
    discountAmount: parseFloat(row.discount_amount || 0),
    couponDiscount: parseFloat(row.coupon_discount || 0),
    tierDiscount: parseFloat(row.tier_discount || 0),
    paidAmount: parseFloat(row.paid_amount || 0),
    pickupCode: row.pickup_code,
    storeName: row.store_name,
    couponUsedId: row.coupon_used_id,
    note: row.note,
    paymentMethod: row.payment_method || null,
    transactionId: row.transaction_id || null,
    paidAt: row.paid_at || null,
    pickupTime: row.pickup_time || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  // Cancel eligibility (only for user-facing queries where cancelMinutes is provided)
  if (cancelMinutes != null && (base.status === 'waiting' || base.status === 'preparing')) {
    const deadline = new Date(new Date(String(base.createdAt).replace(' ', 'T')).getTime() + cancelMinutes * 60000);
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
