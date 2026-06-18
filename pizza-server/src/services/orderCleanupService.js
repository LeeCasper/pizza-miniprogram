/**
 * Order Cleanup Service — auto-cancel unpaid orders past timeout.
 *
 * Runs every 5 minutes via cron. For each expired unpaid order:
 *  1. Cancel the order (race-safe: WHERE payment_method IS NULL)
 *  2. Restore reserved coupon (if any, and not expired)
 *  3. Restore product stock (if stock >= 0)
 *  4. Best-effort close WeChat Pay trade
 *  5. Record audit log
 */

const pool = require('../config/database');
const config = require('../config');
const { createLogger } = require('../utils/logger');
const auditService = require('./auditService');

const log = createLogger('OrderCleanup');

function getUnpaidTimeoutMinutes() {
  return require('../config').business.unpaidTimeoutMinutes;
}

const orderCleanupService = {
  /**
   * Find and cancel all orders that are unpaid past the timeout.
   * @returns {number} count of cancelled orders
   */
  async cancelExpiredUnpaidOrders() {
    const [rows] = await pool.query(
      `SELECT id, coupon_used_id FROM orders
       WHERE status = 'waiting'
         AND payment_method IS NULL
         AND created_at < NOW() - INTERVAL ? MINUTE`,
      [getUnpaidTimeoutMinutes()]
    );

    if (rows.length === 0) return 0;

    let cancelled = 0;

    for (const order of rows) {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();

        // Guard: only cancel if still unpaid (race-safe)
        const [result] = await conn.query(
          `UPDATE orders SET status = 'cancelled', updated_at = NOW()
           WHERE id = ? AND status = 'waiting' AND payment_method IS NULL`,
          [order.id]
        );
        if (result.affectedRows === 0) {
          await conn.rollback();
          continue; // User paid between SELECT and UPDATE
        }

        // Restore coupon if reserved and not expired
        if (order.coupon_used_id) {
          await conn.query(
            `UPDATE coupons SET status = 'available', used_at = NULL
             WHERE id = ? AND status = 'used' AND valid_to >= CURDATE()`,
            [order.coupon_used_id]
          );
        }

        // Restore product stock for each order item
        const [items] = await conn.query(
          'SELECT product_id, quantity FROM order_items WHERE order_id = ?',
          [order.id]
        );
        for (const item of items) {
          await conn.query(
            'UPDATE products SET stock = stock + ? WHERE id = ? AND stock >= 0',
            [item.quantity, item.product_id]
          );
        }

        // Audit log (inside transaction)
        await auditService.record({
          actorType: 'system',
          action: 'order.auto_cancelled',
          entityType: 'order',
          entityId: order.id,
          before: { status: 'waiting', paymentMethod: null },
          after: { status: 'cancelled' },
          metadata: { reason: `Unpaid for ${getUnpaidTimeoutMinutes()}+ minutes` },
        }, conn);

        await conn.commit();
        cancelled++;

        // Best-effort: close WeChat Pay trade (outside TX, non-blocking)
        this._closeWechatTrade(order.id).catch(err => {
          log.warn({ err, orderId: order.id }, 'Close WeChat trade failed (non-fatal)');
        });

        log.info({ orderId: order.id }, 'Auto-cancelled unpaid order');
      } catch (err) {
        await conn.rollback().catch(() => {});
        log.error({ err, orderId: order.id }, 'Auto-cancel failed');
      } finally {
        conn.release();
      }
    }

    return cancelled;
  },

  /**
   * Best-effort close a WeChat Pay trade and mark payment_records as closed.
   */
  async _closeWechatTrade(orderId) {
    // Only attempt if there's a pending payment record
    const [[record]] = await pool.query(
      `SELECT id FROM payment_records
       WHERE reference_id = ? AND type = 'order' AND status = 'pending'`,
      [orderId]
    );
    if (!record) return;

    try {
      const { payRequest } = require('../utils/wechatPay');
      await payRequest(
        'POST',
        `/v3/pay/transactions/out-trade-no/${encodeURIComponent(orderId)}/close`,
        { mchid: config.wxPay.mchId }
      );
    } catch (err) {
      // 400/404 = trade doesn't exist or already closed — safe to ignore
      if (err.statusCode !== 400 && err.statusCode !== 404) throw err;
    }

    await pool.query(
      `UPDATE payment_records SET status = 'closed', updated_at = NOW()
       WHERE reference_id = ? AND type = 'order' AND status = 'pending'`,
      [orderId]
    );
  },
};

module.exports = orderCleanupService;
