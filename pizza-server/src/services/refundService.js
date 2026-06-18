/**
 * Refund Service
 *
 * Handles refunds for cancelled orders:
 * - Balance-paid orders: synchronous balance credit-back
 * - WeChat-paid orders: async WeChat Pay refund API + callback
 *
 * Both paths reverse points and restore coupons within a DB transaction.
 */

const pool = require('../config/database');
const config = require('../config');
const { payRequest, decryptNotify } = require('../utils/wechatPay');
const { getTierLevel } = require('../utils/memberTier');
const { createLogger } = require('../utils/logger');
const log = createLogger('Refund');

const refundService = {
  // ──────────────────────────────────────────────────────────
  // Entry point — called by orderController.cancel / admin cancel
  // ──────────────────────────────────────────────────────────
  async refundOrder(orderId, reason = '用户取消订单') {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Lock order row
      const [orders] = await conn.query(
        'SELECT * FROM orders WHERE id = ? FOR UPDATE',
        [orderId]
      );
      const order = orders[0];
      if (!order) throw Object.assign(new Error('订单不存在'), { statusCode: 404 });
      if (!order.payment_method) throw Object.assign(new Error('订单未支付，无需退款'), { statusCode: 400 });

      // Check for existing successful refund
      const [existing] = await conn.query(
        "SELECT id FROM refund_records WHERE order_id = ? AND status = 'success'",
        [orderId]
      );
      if (existing.length > 0) {
        await conn.rollback();
        return { success: true, alreadyRefunded: true, message: '已退款，无需重复操作' };
      }

      if (order.payment_method === 'balance') {
        const result = await this._refundBalance(conn, order, reason);
        await conn.commit();
        return result;
      } else if (order.payment_method === 'wechat') {
        // Must commit before calling WeChat API (callback may arrive first)
        const result = await this._initiateWechatRefund(conn, order, reason);
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

  // ──────────────────────────────────────────────────────────
  // Balance refund — synchronous, all in one transaction
  // ──────────────────────────────────────────────────────────
  async _refundBalance(conn, order, reason) {
    const userId = order.user_id;
    const refundAmount = parseFloat(order.paid_amount);
    const orderId = order.id;

    // 1. Lock user row
    const [users] = await conn.query(
      'SELECT balance, points, total_spent FROM users WHERE id = ? FOR UPDATE',
      [userId]
    );
    if (!users[0]) throw Object.assign(new Error('用户不存在'), { statusCode: 404 });
    const user = users[0];

    // 2. Refund balance
    const newBalance = parseFloat(user.balance) + refundAmount;
    await conn.query('UPDATE users SET balance = ?, updated_at = NOW() WHERE id = ?', [newBalance, userId]);
    await conn.query(
      'INSERT INTO balance_history (user_id, amount, balance_after, type, remark) VALUES (?, ?, ?, ?, ?)',
      [userId, refundAmount, newBalance, 'refund', `订单退款 ${orderId}`]
    );

    // 3. Reverse points (if any were awarded for this order)
    const pointsReversed = await this._reversePoints(conn, userId, orderId);

    // 4. Restore coupon (if applicable and not expired)
    const couponRestored = await this._restoreCoupon(conn, order.coupon_used_id);

    // 5. Insert refund record
    const outRefundNo = 'R' + orderId;
    await conn.query(
      `INSERT INTO refund_records
       (order_id, user_id, out_refund_no, payment_method, refund_amount, reason, status, points_reversed, coupon_restored)
       VALUES (?, ?, ?, 'balance', ?, ?, 'success', ?, ?)`,
      [orderId, userId, outRefundNo, refundAmount, reason, pointsReversed, couponRestored ? 1 : 0]
    );

    log.info({ orderId, refundAmount, pointsReversed, couponRestored }, 'balance refund SUCCESS');

    return {
      success: true,
      method: 'balance',
      refundAmount,
      pointsReversed,
      couponRestored,
      message: '余额退款已到账',
    };
  },

  // ──────────────────────────────────────────────────────────
  // WeChat refund — two-phase: commit DB first, then call API
  // ──────────────────────────────────────────────────────────
  async _initiateWechatRefund(conn, order, reason) {
    const userId = order.user_id;
    const refundAmount = parseFloat(order.paid_amount);
    const orderId = order.id;
    const outRefundNo = 'R' + orderId;

    // 1. Insert pending refund record
    await conn.query(
      `INSERT INTO refund_records
       (order_id, user_id, out_refund_no, transaction_id, payment_method, refund_amount, reason, status)
       VALUES (?, ?, ?, ?, 'wechat', ?, ?, 'pending')`,
      [orderId, userId, outRefundNo, order.transaction_id, refundAmount, reason]
    );

    // 2. Commit BEFORE calling WeChat API (callback may arrive before we return)
    await conn.commit();

    // 3. Call WeChat Pay refund API
    const amountCents = Math.round(refundAmount * 100);
    const notifyUrl = config.wxPay.refundNotifyUrl;
    try {
      const wxRes = await payRequest('POST', '/v3/refund/domestic/refunds', {
        transaction_id: order.transaction_id,
        out_refund_no: outRefundNo,
        reason,
        amount: {
          refund: amountCents,
          total: amountCents,
          currency: 'CNY',
        },
        notify_url: notifyUrl,
      });

      // 4. Update status to processing
      await pool.query(
        "UPDATE refund_records SET status = 'processing', refund_id = ?, updated_at = NOW() WHERE out_refund_no = ?",
        [wxRes.refund_id || null, outRefundNo]
      );

      log.info({ orderId, refundId: wxRes.refund_id }, 'WeChat refund INITIATED');

      return {
        success: true,
        method: 'wechat',
        refundAmount,
        status: 'processing',
        message: '微信退款处理中，1-5个工作日到账',
      };
    } catch (err) {
      // API call failed — mark as failed
      log.error({ err, orderId }, 'WeChat refund API FAILED');
      await pool.query(
        "UPDATE refund_records SET status = 'failed', updated_at = NOW() WHERE out_refund_no = ?",
        [outRefundNo]
      ).catch(() => {});

      throw Object.assign(new Error('微信退款请求失败，请稍后重试'), { statusCode: 502 });
    }
  },

  // ──────────────────────────────────────────────────────────
  // WeChat refund notification callback
  // ──────────────────────────────────────────────────────────
  async handleRefundNotify(rawBody) {
    let parsed;
    try {
      parsed = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
    } catch (e) {
      return { success: false, reason: 'Invalid JSON' };
    }

    const resource = parsed.resource;
    if (!resource) return { success: false, reason: 'Missing resource' };

    // Decrypt notification
    let decrypted;
    try {
      decrypted = decryptNotify(resource.ciphertext, resource.associated_data, resource.nonce);
    } catch (e) {
      log.error({ err: e }, 'decrypt failed');
      return { success: false, reason: 'Decrypt failed' };
    }

    const outRefundNo = decrypted.out_refund_no;
    const refundStatus = decrypted.refund_status; // SUCCESS / CHANGE / ABNORMAL
    const refundId = decrypted.refund_id;

    log.info({ outRefundNo, refundStatus }, 'refund notify received');

    // Look up refund record
    const [records] = await pool.query(
      'SELECT * FROM refund_records WHERE out_refund_no = ?',
      [outRefundNo]
    );
    if (!records[0]) return { success: false, reason: 'Refund record not found' };
    const record = records[0];

    // Idempotency: already processed
    if (record.status === 'success') return { success: true, detail: 'Already processed' };

    if (refundStatus !== 'SUCCESS') {
      await pool.query(
        "UPDATE refund_records SET status = 'failed', refund_id = ?, raw_notify = ?, updated_at = NOW() WHERE out_refund_no = ?",
        [refundId, JSON.stringify(decrypted), outRefundNo]
      );
      return { success: true, detail: `Refund ${refundStatus}` };
    }

    // ── SUCCESS path — process in transaction ──
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Guard: only process pending/processing records (prevents double-processing)
      const [upd] = await conn.query(
        "UPDATE refund_records SET status = 'success', refund_id = ?, raw_notify = ?, updated_at = NOW() WHERE out_refund_no = ? AND status IN ('pending','processing')",
        [refundId, JSON.stringify(decrypted), outRefundNo]
      );
      if (upd.affectedRows === 0) {
        await conn.rollback();
        return { success: true, detail: 'Already processed (race)' };
      }

      const userId = record.user_id;
      const orderId = record.order_id;
      const refundAmount = parseFloat(record.refund_amount);

      // Lock user row
      const [users] = await conn.query(
        'SELECT points, total_spent FROM users WHERE id = ? FOR UPDATE',
        [userId]
      );
      if (!users[0]) {
        await conn.commit();
        return { success: true, detail: 'User not found, record updated' };
      }
      const user = users[0];

      // Reverse points
      const pointsReversed = await this._reversePoints(conn, userId, orderId);

      // Reverse total_spent (WeChat payments DO increment total_spent)
      const newTotalSpent = Math.max(0, parseFloat(user.total_spent) - refundAmount);
      const newLevel = await getTierLevel(newTotalSpent);
      await conn.query(
        'UPDATE users SET total_spent = ?, member_level = ?, updated_at = NOW() WHERE id = ?',
        [newTotalSpent, newLevel, userId]
      );

      // Restore coupon
      const [orderRows] = await conn.query('SELECT coupon_used_id FROM orders WHERE id = ?', [orderId]);
      const couponId = orderRows[0]?.coupon_used_id;
      const couponRestored = await this._restoreCoupon(conn, couponId);

      // Update refund record with reversal info
      await conn.query(
        'UPDATE refund_records SET points_reversed = ?, coupon_restored = ? WHERE out_refund_no = ?',
        [pointsReversed, couponRestored ? 1 : 0, outRefundNo]
      );

      await conn.commit();
      log.info({ orderId, pointsReversed, totalSpent: newTotalSpent, level: newLevel }, 'WeChat notify SUCCESS');
      return { success: true, detail: `Refund completed for order ${orderId}` };
    } catch (err) {
      await conn.rollback().catch(() => {});
      log.error({ err }, 'notify processing error');
      throw err;
    } finally {
      conn.release();
    }
  },

  // ──────────────────────────────────────────────────────────
  // Helper: reverse points earned for an order
  // ──────────────────────────────────────────────────────────
  async _reversePoints(conn, userId, orderId) {
    // Find points awarded for this order
    const [phRows] = await conn.query(
      "SELECT SUM(points_change) AS earned FROM points_history WHERE user_id = ? AND reference_id = ? AND points_change > 0",
      [userId, orderId]
    );
    const earned = phRows[0]?.earned || 0;
    if (earned <= 0) return 0;

    // Deduct points (floor at 0)
    await conn.query(
      'UPDATE users SET points = GREATEST(0, CAST(points AS SIGNED) - ?), updated_at = NOW() WHERE id = ?',
      [earned, userId]
    );

    // Get updated balance for history
    const [uRows] = await conn.query('SELECT points FROM users WHERE id = ?', [userId]);
    const pointsAfter = uRows[0]?.points || 0;

    await conn.query(
      'INSERT INTO points_history (user_id, points_change, balance_after, reason, reference_id) VALUES (?, ?, ?, ?, ?)',
      [userId, -earned, pointsAfter, '订单退款', orderId]
    );

    return earned;
  },

  // ──────────────────────────────────────────────────────────
  // Helper: restore a used coupon (only if not expired)
  // ──────────────────────────────────────────────────────────
  async _restoreCoupon(conn, couponId) {
    if (!couponId) return false;
    const [upd] = await conn.query(
      "UPDATE coupons SET status = 'available', used_at = NULL WHERE id = ? AND status = 'used' AND valid_to >= CURDATE()",
      [couponId]
    );
    return upd.affectedRows > 0;
  },
};

module.exports = refundService;
