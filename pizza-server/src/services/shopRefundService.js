/**
 * Shop Refund Service — 会员商城退款
 *
 * 自包含于 shop 模块，绝不修改 refundService.js。
 * - 余额支付退款：同步（退余额 + 回补库存）
 * - 微信支付退款：两阶段（DB 先落 pending → 调微信退款 API → 回调结算）
 *
 * 注意：余额支付的商城订单不更新 total_spent/points，所以退款无需回退；
 *       微信支付的商城订单在 settleShopOrder 中更新了这两项，退款必须回退。
 */
const pool = require('../config/database');
const config = require('../config');
const { payRequest, decryptNotify } = require('../utils/wechatPay');
const { getTierLevel } = require('../utils/memberTier');
const { createLogger } = require('../utils/logger');
const auditService = require('./auditService');
const log = createLogger('ShopRefund');

const shopRefundService = {
  // ── 入口 ────────────────────────────────────────────
  /**
   * @param {string} orderId  — shop_orders.id
   * @param {string} reason
   * @param {object} actor    — { id, role } 或 { id }
   */
  async refund(orderId, reason = '用户申请退款', actor = {}) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // 锁定订单
      const [[order]] = await conn.query(
        'SELECT * FROM shop_orders WHERE id = ? FOR UPDATE', [orderId]
      );
      if (!order) throw Object.assign(new Error('订单不存在'), { statusCode: 404 });
      if (!order.payment_method) {
        throw Object.assign(new Error('订单未支付，无需退款'), { statusCode: 400 });
      }
      if (order.refund_status === 'processing' || order.refund_status === 'success') {
        throw Object.assign(new Error('已退款或退款处理中，请勿重复操作'), { statusCode: 400 });
      }

      // 标记退款处理中
      await conn.query(
        "UPDATE shop_orders SET refund_status = 'processing', updated_at = NOW() WHERE id = ?",
        [orderId]
      );

      // 审计：退款发起
      await auditService.record({
        actorType: actor.role === 'admin' ? 'admin' : 'user',
        actorId: String(actor.id || 'system'),
        action: 'shop_refund.initiated',
        entityType: 'shop_order',
        entityId: orderId,
        before: { status: order.status, paymentMethod: order.payment_method, paidAmount: parseFloat(order.paid_amount) },
        after: { reason },
      }, conn);

      if (order.payment_method === 'balance') {
        const result = await this._refundBalance(conn, order, reason, actor);
        await conn.commit();
        return result;
      } else if (order.payment_method === 'wechat') {
        // 必须先 commit（微信回调可能比 API 响应先到）
        const result = await this._initiateWechatRefund(conn, order, reason, actor);
        return result;
      } else {
        throw Object.assign(new Error('未知支付方式'), { statusCode: 400 });
      }
    } catch (err) {
      await conn.rollback().catch(() => {});
      throw err;
    } finally {
      conn.release();
    }
  },

  // ── 余额退款（同步，单事务） ────────────────────────
  async _refundBalance(conn, order, reason, actor) {
    const userId = order.user_id;
    const refundAmount = parseFloat(order.paid_amount);
    const orderId = order.id;

    // 1. 锁定用户
    const [[user]] = await conn.query(
      'SELECT balance FROM users WHERE id = ? FOR UPDATE', [userId]
    );
    if (!user) throw Object.assign(new Error('用户不存在'), { statusCode: 404 });

    // 2. 退回余额
    const newBalance = parseFloat(user.balance) + refundAmount;
    await conn.query(
      'UPDATE users SET balance = ?, updated_at = NOW() WHERE id = ?',
      [newBalance, userId]
    );
    await conn.query(
      'INSERT INTO balance_history (user_id, amount, balance_after, type, remark) VALUES (?, ?, ?, ?, ?)',
      [userId, refundAmount, newBalance, 'refund', `商城订单退款 ${orderId}`]
    );

    // 3. 退款记录（直接成功）
    const outRefundNo = 'SR' + orderId;
    await conn.query(
      `INSERT INTO shop_refund_records
       (order_id, user_id, out_refund_no, payment_method, refund_amount, reason, status)
       VALUES (?, ?, ?, 'balance', ?, ?, 'success')`,
      [orderId, userId, outRefundNo, refundAmount, reason]
    );

    // 4. 回补库存
    await this._restoreStock(conn, orderId);

    // 5. 更新订单退款状态
    await conn.query(
      `UPDATE shop_orders
       SET refund_status = 'success', refund_amount = ?, refund_reason = ?, refunded_at = NOW(), updated_at = NOW()
       WHERE id = ?`,
      [refundAmount, reason, orderId]
    );

    // 6. 审计
    await auditService.record({
      actorType: actor.role === 'admin' ? 'admin' : 'user',
      actorId: String(actor.id || 'system'),
      action: 'shop_refund.completed',
      entityType: 'shop_order',
      entityId: orderId,
      after: { method: 'balance', refundAmount },
    }, conn);

    log.info({ orderId, refundAmount }, 'Shop balance refund SUCCESS');
    return { success: true, method: 'balance', refundAmount, message: '余额退款已到账' };
  },

  // ── 微信退款（两阶段） ──────────────────────────────
  async _initiateWechatRefund(conn, order, reason, actor) {
    const userId = order.user_id;
    const refundAmount = parseFloat(order.paid_amount);
    const orderId = order.id;
    const outRefundNo = 'SR' + orderId;

    // 1. 查找微信交易号
    const [[paymentRecord]] = await conn.query(
      "SELECT transaction_id FROM payment_records WHERE reference_id = ? AND type = 'shop_order' AND status = 'success'",
      [orderId]
    );
    if (!paymentRecord || !paymentRecord.transaction_id) {
      throw Object.assign(new Error('未找到微信支付交易记录，无法发起退款'), { statusCode: 400 });
    }
    const transactionId = paymentRecord.transaction_id;

    // 2. 插入 pending 退款记录
    await conn.query(
      `INSERT INTO shop_refund_records
       (order_id, user_id, out_refund_no, transaction_id, payment_method, refund_amount, reason, status)
       VALUES (?, ?, ?, ?, 'wechat', ?, ?, 'pending')`,
      [orderId, userId, outRefundNo, transactionId, refundAmount, reason]
    );

    // 3. 提交（微信回调可能比 API 响应先到）
    await conn.commit();

    // 4. 调用微信退款 API
    const amountCents = Math.round(refundAmount * 100);
    const notifyUrl = config.wxPay.refundNotifyUrl;
    try {
      const wxRes = await payRequest('POST', '/v3/refund/domestic/refunds', {
        transaction_id: transactionId,
        out_refund_no: outRefundNo,
        reason,
        amount: {
          refund: amountCents,
          total: amountCents,
          currency: 'CNY',
        },
        notify_url: notifyUrl,
      });

      await pool.query(
        "UPDATE shop_refund_records SET status = 'processing', refund_id = ?, updated_at = NOW() WHERE out_refund_no = ?",
        [wxRes.refund_id || null, outRefundNo]
      );

      log.info({ orderId, refundId: wxRes.refund_id }, 'Shop WeChat refund INITIATED');
      return { success: true, method: 'wechat', refundAmount, status: 'processing', message: '微信退款处理中，1-5个工作日到账' };
    } catch (err) {
      log.error({ err, orderId }, 'Shop WeChat refund API FAILED');
      await pool.query(
        "UPDATE shop_refund_records SET status = 'failed', updated_at = NOW() WHERE out_refund_no = ?",
        [outRefundNo]
      ).catch(() => {});
      await pool.query(
        "UPDATE shop_orders SET refund_status = 'failed', updated_at = NOW() WHERE id = ?",
        [orderId]
      ).catch(() => {});
      throw Object.assign(new Error('微信退款请求失败，请稍后重试'), { statusCode: 502 });
    }
  },

  // ── 微信退款回调 ────────────────────────────────────
  /**
   * @param {string|object} rawBody — 微信回调原始 body
   * @returns {{ success: boolean, detail: string }}
   */
  async handleRefundNotify(rawBody) {
    let parsed;
    try {
      parsed = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
    } catch (e) {
      return { success: false, reason: 'Invalid JSON' };
    }

    const resource = parsed.resource;
    if (!resource) return { success: false, reason: 'Missing resource' };

    let decrypted;
    try {
      decrypted = decryptNotify(resource.ciphertext, resource.associated_data, resource.nonce);
    } catch (e) {
      log.error({ err: e }, 'Shop refund decrypt failed');
      return { success: false, reason: 'Decrypt failed' };
    }

    const outRefundNo = decrypted.out_refund_no;
    const refundStatus = decrypted.refund_status;
    const refundId = decrypted.refund_id;

    // 非商城退款 → 不处理
    if (!outRefundNo || !outRefundNo.startsWith('SR')) {
      return { success: false, reason: 'Not a shop refund' };
    }

    log.info({ outRefundNo, refundStatus }, 'Shop refund notify received');

    // 查找退款记录
    const [[record]] = await pool.query(
      'SELECT * FROM shop_refund_records WHERE out_refund_no = ?', [outRefundNo]
    );
    if (!record) return { success: false, reason: 'Shop refund record not found' };
    if (record.status === 'success') return { success: true, detail: 'Already processed' };

    if (refundStatus !== 'SUCCESS') {
      await pool.query(
        "UPDATE shop_refund_records SET status = 'failed', refund_id = ?, raw_notify = ?, updated_at = NOW() WHERE out_refund_no = ?",
        [refundId, JSON.stringify(decrypted), outRefundNo]
      );
      return { success: true, detail: `Refund ${refundStatus}` };
    }

    // ── SUCCESS 结算 ──
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Guard: only process pending/processing
      const [upd] = await conn.query(
        "UPDATE shop_refund_records SET status = 'success', refund_id = ?, raw_notify = ?, updated_at = NOW() WHERE out_refund_no = ? AND status IN ('pending','processing')",
        [refundId, JSON.stringify(decrypted), outRefundNo]
      );
      if (upd.affectedRows === 0) {
        await conn.rollback();
        return { success: true, detail: 'Already processed (race)' };
      }

      const userId = record.user_id;
      const orderId = record.order_id;
      const refundAmount = parseFloat(record.refund_amount);

      // 锁定用户
      const [[user]] = await conn.query(
        'SELECT points, total_spent, member_level FROM users WHERE id = ? FOR UPDATE', [userId]
      );
      if (!user) {
        // 用户已删除，仅更新订单
        await conn.query(
          `UPDATE shop_orders
           SET refund_status = 'success', refund_amount = ?, refunded_at = NOW(), updated_at = NOW()
           WHERE id = ?`,
          [refundAmount, orderId]
        );
        await conn.commit();
        return { success: true, detail: 'User not found, order refunded' };
      }

      // 回退积分（微信支付的 settleShopOrder 会奖励积分）
      const pointsReversed = await this._reversePoints(conn, userId, orderId);

      // 回退 total_spent + 重算等级
      const oldTotalSpent = parseFloat(user.total_spent);
      const newTotalSpent = Math.max(0, oldTotalSpent - refundAmount);
      const newLevel = await getTierLevel(newTotalSpent);
      await conn.query(
        'UPDATE users SET total_spent = ?, member_level = ?, updated_at = NOW() WHERE id = ?',
        [newTotalSpent.toFixed(2), newLevel, userId]
      );

      // 回补库存
      await this._restoreStock(conn, orderId);

      // 更新退款记录
      await conn.query(
        'UPDATE shop_refund_records SET points_reversed = ?, total_spent_reversed = ? WHERE out_refund_no = ?',
        [pointsReversed, refundAmount, outRefundNo]
      );

      // 更新订单退款状态
      await conn.query(
        `UPDATE shop_orders
         SET refund_status = 'success', refund_amount = ?, refunded_at = NOW(), updated_at = NOW()
         WHERE id = ?`,
        [refundAmount, orderId]
      );

      // 审计
      await auditService.record({
        actorType: 'system',
        action: 'shop_refund.completed',
        entityType: 'shop_order',
        entityId: orderId,
        after: { method: 'wechat', refundAmount, pointsReversed, totalSpentReversed: refundAmount, refundId },
      }, conn);

      await conn.commit();
      log.info({ orderId, pointsReversed, totalSpent: newTotalSpent, level: newLevel }, 'Shop WeChat notify SUCCESS');
      return { success: true, detail: `Refund completed for shop order ${orderId}` };
    } catch (err) {
      await conn.rollback().catch(() => {});
      log.error({ err }, 'Shop refund notify processing error');
      throw err;
    } finally {
      conn.release();
    }
  },

  // ── 辅助：回退积分 ──────────────────────────────────
  /**
   * 查询该订单奖励的积分并扣回（仅微信支付才有积分奖励）。
   */
  async _reversePoints(conn, userId, orderId) {
    const [[row]] = await conn.query(
      'SELECT SUM(points_change) AS earned FROM points_history WHERE user_id = ? AND reference_id = ? AND points_change > 0',
      [userId, orderId]
    );
    const earned = row?.earned || 0;
    if (earned <= 0) return 0;

    await conn.query(
      'UPDATE users SET points = GREATEST(0, CAST(points AS SIGNED) - ?), updated_at = NOW() WHERE id = ?',
      [earned, userId]
    );

    const [[u]] = await conn.query('SELECT points FROM users WHERE id = ?', [userId]);
    const pointsAfter = u?.points || 0;

    await conn.query(
      'INSERT INTO points_history (user_id, points_change, balance_after, reason, reference_id) VALUES (?, ?, ?, ?, ?)',
      [userId, -earned, pointsAfter, '商城退款', orderId]
    );

    return earned;
  },

  // ── 辅助：回补库存 ──────────────────────────────────
  async _restoreStock(conn, orderId) {
    const [items] = await conn.query(
      'SELECT shop_product_id, quantity FROM shop_order_items WHERE order_id = ?',
      [orderId]
    );
    for (const item of items) {
      if (item.shop_product_id == null) continue;
      await conn.query(
        `UPDATE shop_products
         SET stock = stock + ?, sales = GREATEST(0, CAST(sales AS SIGNED) - ?)
         WHERE id = ? AND stock >= 0`,
        [item.quantity, item.quantity, item.shop_product_id]
      );
    }
  },
};

module.exports = shopRefundService;
