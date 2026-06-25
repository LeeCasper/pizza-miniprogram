// src/services/shopOrderService.js — 会员商城订单
const pool = require('../config/database');
const { createLogger } = require('../utils/logger');
const log = createLogger('ShopOrder');
const auditService = require('./auditService');

// Shop order state machine
// pending  → paid (payment callback / balance at create)
// pending  → cancelled (user or admin cancel)
// paid     → shipped (admin sets shipping info)
// paid     → cancelled (admin cancel, with refund)
// shipped  → completed (admin marks complete)
const VALID_TRANSITIONS = {
  pending: ['paid', 'cancelled'],
  paid: ['shipped', 'cancelled'],
  shipped: ['completed'],
  completed: [],
  cancelled: [],
};

function validateTransition(current, next) {
  const allowed = VALID_TRANSITIONS[current];
  if (!allowed || !allowed.includes(next)) {
    return { valid: false, reason: `不允许从 ${current} 转换到 ${next}` };
  }
  return { valid: true };
}

const STATUS_LABELS = {
  pending: '待支付',
  paid: '已支付',
  shipped: '已发货',
  completed: '已完成',
  cancelled: '已取消',
};

const shopOrderService = {
  // ── ID 生成：SH+YYYYMMDD+3位序号 ──────────────────────
  async generateOrderId(conn) {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const datePrefix = `${y}${m}${d}`;
    const prefix = `SH${datePrefix}`;
    const [[row]] = await conn.query(
      `SELECT MAX(CAST(SUBSTRING(id, 11) AS UNSIGNED)) AS maxSeq
       FROM shop_orders WHERE id LIKE ?`,
      [`${prefix}%`]
    );
    const seq = String((row.maxSeq || 0) + 1).padStart(3, '0');
    return `${prefix}${seq}`;
  },

  // ── 创建订单（含库存扣减 + 余额支付）──────────────────
  /**
   * @param {object} opts
   * @param {number} opts.userId
   * @param {number} opts.productId
   * @param {number} opts.quantity
   * @param {string} opts.recipientName
   * @param {string} opts.recipientPhone
   * @param {string} opts.recipientAddress
   * @param {string} [opts.note]
   * @param {'wechat'|'balance'} opts.paymentMethod
   * @returns {object} { order, paymentStatus }
   */
  async create({ userId, productId, quantity, recipientName, recipientPhone, recipientAddress, note, paymentMethod }) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // 1. 锁定商品行（FOR UPDATE）
      const [[product]] = await conn.query(
        `SELECT id, name, main_image, price, stock
         FROM shop_products
         WHERE id = ? AND is_available = 1 AND is_deleted = 0
         FOR UPDATE`,
        [productId]
      );
      if (!product) {
        await conn.rollback();
        throw Object.assign(new Error('商品不存在或已下架'), { statusCode: 400 });
      }

      const price = parseFloat(product.price);
      const stock = product.stock;

      // 2. 库存检查（stock < 0 表示无限库存）
      if (stock >= 0 && stock < quantity) {
        await conn.rollback();
        throw Object.assign(new Error(`库存不足，当前库存 ${stock}`), { statusCode: 400 });
      }

      // 3. 扣减库存 + 增加销量
      if (stock >= 0) {
        const [stockResult] = await conn.query(
          `UPDATE shop_products SET stock = stock - ?, sales = sales + ? WHERE id = ? AND stock >= ?`,
          [quantity, quantity, productId, quantity]
        );
        if (stockResult.affectedRows === 0) {
          await conn.rollback();
          throw Object.assign(new Error('库存不足'), { statusCode: 400 });
        }
      } else {
        // 无限库存，仅增加销量
        await conn.query(
          'UPDATE shop_products SET sales = sales + ? WHERE id = ?',
          [quantity, productId]
        );
      }

      // 4. 计算金额（无优惠券/会员折扣 — YAGNI）
      const totalAmount = +(price * quantity).toFixed(2);
      const paidAmount = totalAmount;

      // 5. 生成订单 ID
      const orderId = await this.generateOrderId(conn);

      // 6. 余额支付：一次性完成支付
      let paymentStatus = 'unpaid';
      let paidAt = null;
      let paymentMethodValue = null;

      if (paymentMethod === 'balance') {
        // 锁定用户行
        const [[user]] = await conn.query(
          'SELECT balance FROM users WHERE id = ? FOR UPDATE',
          [userId]
        );
        if (!user) {
          await conn.rollback();
          throw Object.assign(new Error('用户不存在'), { statusCode: 404 });
        }
        const balance = parseFloat(user.balance);
        if (balance < paidAmount) {
          await conn.rollback();
          throw Object.assign(
            new Error(`余额不足，还需 ¥${(paidAmount - balance).toFixed(2)}`),
            { statusCode: 400, code: 'INSUFFICIENT_BALANCE' }
          );
        }
        const balanceAfter = +(balance - paidAmount).toFixed(2);
        await conn.query('UPDATE users SET balance = ? WHERE id = ?', [balanceAfter, userId]);
        try {
          await conn.query(
            'INSERT INTO balance_history (user_id, amount, balance_after, type, remark) VALUES (?, ?, ?, ?, ?)',
            [userId, paidAmount, balanceAfter, 'deduct', `商城订单支付 ${orderId}`]
          );
        } catch (histErr) {
          log.warn({ err: histErr }, 'balance_history insert skipped');
        }
        paymentStatus = 'paid';
        paidAt = new Date();
        paymentMethodValue = 'balance';

        // 插入 payment_records
        await conn.query(
          `INSERT INTO payment_records (user_id, type, reference_id, out_trade_no, amount, status)
           VALUES (?, 'shop_order', ?, ?, ?, 'success')`,
          [userId, orderId, orderId, paidAmount]
        );
      }

      // 7. 插入订单
      const status = paymentStatus === 'paid' ? 'paid' : 'pending';
      await conn.query(
        `INSERT INTO shop_orders
         (id, user_id, total_amount, paid_amount, payment_method, status,
          recipient_name, recipient_phone, recipient_address, note,
          paid_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [orderId, userId, totalAmount, paidAmount, paymentMethodValue, status,
         recipientName, recipientPhone, recipientAddress, note || null,
         paidAt]
      );

      // 8. 插入订单明细（价格快照）
      await conn.query(
        `INSERT INTO shop_order_items
         (order_id, shop_product_id, product_name, product_image, price, quantity, subtotal)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [orderId, productId, product.name, product.main_image, price, quantity, +(price * quantity).toFixed(2)]
      );

      await conn.commit();

      // 9. 审计日志（fire-and-forget）
      auditService.record({
        actorType: 'user',
        actorId: String(userId),
        action: paymentMethod === 'balance' ? 'shop_order.created_paid' : 'shop_order.created',
        entityType: 'shop_order',
        entityId: orderId,
        after: { totalAmount, paidAmount, paymentMethod, status, productId, quantity },
      }).catch(() => {});

      // 10. 返回格式化订单
      const order = await this.findById(orderId);
      return { order, paymentStatus, paymentMethod: paymentMethodValue };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  // ── 单条查询 ────────────────────────────────────────
  async findById(orderId) {
    const [[order]] = await pool.query(
      'SELECT * FROM shop_orders WHERE id = ?', [orderId]
    );
    if (!order) return null;
    const [items] = await pool.query(
      'SELECT * FROM shop_order_items WHERE order_id = ?', [orderId]
    );
    return formatShopOrder(order, items);
  },

  // ── 用户订单列表 ─────────────────────────────────────
  /**
   * @param {number} userId
   * @param {string} [status] — status filter
   * @param {number} [page=1]
   * @param {number} [limit=20]
   */
  async findByUser(userId, status, page = 1, limit = 20) {
    const params = [userId];
    let where = 'WHERE o.user_id = ?';
    if (status && status !== 'all') {
      where += ' AND o.status = ?';
      params.push(status);
    }

    // count
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM shop_orders o ${where}`, params
    );

    // list
    const offset = (page - 1) * limit;
    const [orders] = await pool.query(
      `SELECT o.* FROM shop_orders o ${where} ORDER BY o.created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    if (orders.length === 0) return { list: [], total };

    // batch-load items
    const orderIds = orders.map(o => o.id);
    const [allItems] = await pool.query(
      'SELECT * FROM shop_order_items WHERE order_id IN (?)', [orderIds]
    );
    const itemsMap = {};
    for (const item of allItems) {
      if (!itemsMap[item.order_id]) itemsMap[item.order_id] = [];
      itemsMap[item.order_id].push(item);
    }

    return {
      list: orders.map(o => formatShopOrder(o, itemsMap[o.id] || [])),
      total,
    };
  },

  // ── 管理端：订单列表 ──────────────────────────────────
  /**
   * @param {object} opts
   * @param {string} [opts.status]
   * @param {string} [opts.paymentMethod]
   * @param {number} [opts.page=1]
   * @param {number} [opts.limit=20]
   */
  async adminList({ status, paymentMethod, page = 1, limit = 20 } = {}) {
    const conditions = [];
    const params = [];

    if (status && status !== 'all') {
      conditions.push('o.status = ?');
      params.push(status);
    }
    if (paymentMethod && paymentMethod !== 'all') {
      if (paymentMethod === 'unpaid') {
        conditions.push('o.payment_method IS NULL');
      } else {
        conditions.push('o.payment_method = ?');
        params.push(paymentMethod);
      }
    }

    let where = '';
    if (conditions.length > 0) {
      where = 'WHERE ' + conditions.join(' AND ');
    }

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM shop_orders o ${where}`, params
    );

    const offset = (page - 1) * limit;
    const [orders] = await pool.query(
      `SELECT o.*, u.name AS user_name
       FROM shop_orders o
       JOIN users u ON o.user_id = u.id
       ${where}
       ORDER BY o.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    if (orders.length === 0) return { list: [], total };

    // batch-load items
    const orderIds = orders.map(o => o.id);
    const [allItems] = await pool.query(
      'SELECT * FROM shop_order_items WHERE order_id IN (?)', [orderIds]
    );
    const itemsMap = {};
    for (const item of allItems) {
      if (!itemsMap[item.order_id]) itemsMap[item.order_id] = [];
      itemsMap[item.order_id].push(item);
    }

    return {
      list: orders.map(o => formatShopOrder(o, itemsMap[o.id] || [], true)),
      total,
    };
  },

  // ── 管理端：更新状态 ──────────────────────────────────
  /**
   * @param {string} orderId
   * @param {string} newStatus
   * @param {object} adminUser — { id, role }
   */
  async adminUpdateStatus(orderId, newStatus, adminUser) {
    const [[order]] = await pool.query(
      'SELECT * FROM shop_orders WHERE id = ?', [orderId]
    );
    if (!order) {
      throw Object.assign(new Error('订单不存在'), { statusCode: 404 });
    }

    const transition = validateTransition(order.status, newStatus);
    if (!transition.valid) {
      throw Object.assign(new Error(transition.reason), {
        statusCode: 400,
        code: 'INVALID_TRANSITION',
      });
    }

    // 设置时间戳
    const timestampFields = {};
    if (newStatus === 'paid' && !order.paid_at) timestampFields.paid_at = new Date();
    if (newStatus === 'shipped') timestampFields.shipped_at = new Date();
    if (newStatus === 'completed') timestampFields.completed_at = new Date();

    let setClauses = ['status = ?', 'updated_at = NOW()'];
    let params = [newStatus];
    for (const [col, val] of Object.entries(timestampFields)) {
      setClauses.push(`${col} = ?`);
      params.push(val);
    }
    params.push(orderId);

    await pool.query(
      `UPDATE shop_orders SET ${setClauses.join(', ')} WHERE id = ?`,
      params
    );

    // 审计
    auditService.record({
      actorType: 'admin',
      actorId: String(adminUser.id),
      action: 'shop_order.status_change',
      entityType: 'shop_order',
      entityId: orderId,
      before: { status: order.status },
      after: { status: newStatus },
    }).catch(() => {});

    log.info({ orderId, from: order.status, to: newStatus, adminId: adminUser.id }, 'Shop order status updated');

    return this.findById(orderId);
  },

  // ── 管理端：更新物流 ──────────────────────────────────
  /**
   * @param {string} orderId
   * @param {object} shipping
   * @param {string} shipping.shippingCompany
   * @param {string} shipping.trackingNo
   */
  async adminUpdateShipping(orderId, { shippingCompany, trackingNo }) {
    const [[order]] = await pool.query(
      'SELECT * FROM shop_orders WHERE id = ?', [orderId]
    );
    if (!order) {
      throw Object.assign(new Error('订单不存在'), { statusCode: 404 });
    }
    if (order.status !== 'paid') {
      throw Object.assign(new Error('只能为已支付订单设置物流信息'), { statusCode: 400 });
    }

    await pool.query(
      `UPDATE shop_orders
       SET shipping_company = ?, tracking_no = ?, status = 'shipped', shipped_at = NOW(), updated_at = NOW()
       WHERE id = ?`,
      [shippingCompany, trackingNo, orderId]
    );

    auditService.record({
      actorType: 'admin',
      action: 'shop_order.shipping',
      entityType: 'shop_order',
      entityId: orderId,
      after: { shippingCompany, trackingNo, status: 'shipped' },
    }).catch(() => {});

    log.info({ orderId, shippingCompany, trackingNo }, 'Shop order shipping updated');

    return this.findById(orderId);
  },

  // ── 用户取消订单 ──────────────────────────────────────
  /**
   * @param {string} orderId
   * @param {number} userId
   * @returns {object} cancelled order
   */
  async cancelByUser(orderId, userId) {
    const [[order]] = await pool.query(
      'SELECT * FROM shop_orders WHERE id = ? AND user_id = ?', [orderId, userId]
    );
    if (!order) {
      throw Object.assign(new Error('订单不存在'), { statusCode: 404 });
    }
    if (order.status !== 'pending') {
      throw Object.assign(new Error('只能取消待支付订单'), { statusCode: 400 });
    }

    // 恢复库存
    const [items] = await pool.query(
      'SELECT * FROM shop_order_items WHERE order_id = ?', [orderId]
    );
    for (const item of items) {
      await pool.query(
        `UPDATE shop_products
         SET stock = stock + ?, sales = GREATEST(0, sales - ?)
         WHERE id = ? AND stock >= 0`,
        [item.quantity, item.quantity, item.shop_product_id]
      );
    }

    await pool.query(
      `UPDATE shop_orders SET status = 'cancelled', updated_at = NOW() WHERE id = ?`,
      [orderId]
    );

    auditService.record({
      actorType: 'user',
      actorId: String(userId),
      action: 'shop_order.cancelled',
      entityType: 'shop_order',
      entityId: orderId,
    }).catch(() => {});

    log.info({ orderId, userId }, 'Shop order cancelled by user');

    return this.findById(orderId);
  },

  // ── 获取支付状态 ──────────────────────────────────────
  async getPaymentStatus(orderId) {
    const [[order]] = await pool.query(
      'SELECT id, status, payment_method, paid_at FROM shop_orders WHERE id = ?',
      [orderId]
    );
    if (!order) return null;

    const [[record]] = await pool.query(
      "SELECT * FROM payment_records WHERE reference_id = ? AND type = 'shop_order'",
      [orderId]
    );

    return {
      orderId: order.id,
      orderStatus: order.status,
      paymentMethod: order.payment_method,
      paidAt: order.paid_at,
      paymentRecordStatus: record ? record.status : null,
      transactionId: record ? record.transaction_id : null,
    };
  },
};

// ── 格式化 ─────────────────────────────────────────────
function formatShopOrder(row, items = [], includeUserName = false) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    userName: includeUserName ? (row.user_name || null) : undefined,
    totalAmount: parseFloat(row.total_amount),
    paidAmount: parseFloat(row.paid_amount),
    paymentMethod: row.payment_method,
    status: row.status,
    statusLabel: STATUS_LABELS[row.status] || row.status,
    recipientName: row.recipient_name,
    recipientPhone: row.recipient_phone,
    recipientAddress: row.recipient_address,
    shippingCompany: row.shipping_company,
    trackingNo: row.tracking_no,
    note: row.note,
    paidAt: row.paid_at,
    shippedAt: row.shipped_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: items.map(formatShopOrderItem),
  };
}

function formatShopOrderItem(row) {
  if (!row) return null;
  return {
    id: row.id,
    orderId: row.order_id,
    shopProductId: row.shop_product_id,
    productName: row.product_name,
    productImage: row.product_image,
    price: parseFloat(row.price),
    quantity: row.quantity,
    subtotal: parseFloat(row.subtotal),
  };
}

module.exports = shopOrderService;
