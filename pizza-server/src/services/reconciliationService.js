/**
 * Reconciliation Service — cross-check WeChat payment records against orders.
 */

const pool = require('../config/database');
const { createLogger } = require('../utils/logger');

const log = createLogger('Reconciliation');

const reconciliationService = {
  /**
   * Reconcile payment_records vs orders for a date range.
   * Returns summary + list of mismatches.
   *
   * @param {string} dateFrom - YYYY-MM-DD
   * @param {string} dateTo   - YYYY-MM-DD
   */
  async reconcile(dateFrom, dateTo) {
    // 1. Successful payment_records (orders) that don't match orders
    const [paymentSide] = await pool.query(
      `SELECT pr.id AS prId, pr.reference_id AS orderId, pr.amount AS prAmount,
              pr.transaction_id AS prTransactionId, pr.status AS prStatus, pr.created_at AS prCreatedAt,
              o.id AS oId, o.paid_amount AS oAmount, o.payment_method, o.transaction_id AS oTransactionId,
              o.status AS oStatus
       FROM payment_records pr
       LEFT JOIN orders o ON pr.reference_id = o.id
       WHERE pr.type = 'order'
         AND pr.status = 'success'
         AND pr.created_at >= ? AND pr.created_at < DATE_ADD(?, INTERVAL 1 DAY)`,
      [dateFrom, dateTo]
    );

    // 2. Paid orders that have no matching successful payment_record
    const [orderSide] = await pool.query(
      `SELECT o.id AS orderId, o.paid_amount, o.payment_method, o.transaction_id, o.status, o.created_at
       FROM orders o
       LEFT JOIN payment_records pr
         ON pr.reference_id = o.id AND pr.type = 'order' AND pr.status = 'success'
       WHERE o.payment_method = 'wechat'
         AND o.created_at >= ? AND o.created_at < DATE_ADD(?, INTERVAL 1 DAY)
         AND pr.id IS NULL`,
      [dateFrom, dateTo]
    );

    const mismatches = [];

    // Check payment-side mismatches
    for (const r of paymentSide) {
      if (!r.oId) {
        mismatches.push({
          type: 'payment_no_order',
          description: '支付成功但无对应订单',
          paymentRecordId: r.prId,
          orderId: r.orderId,
          amount: parseFloat(r.prAmount),
          transactionId: r.prTransactionId,
        });
        continue;
      }

      // Amount mismatch
      if (Math.abs(parseFloat(r.prAmount) - parseFloat(r.oAmount)) > 0.01) {
        mismatches.push({
          type: 'amount_mismatch',
          description: '支付金额与订单金额不一致',
          orderId: r.orderId,
          paymentAmount: parseFloat(r.prAmount),
          orderAmount: parseFloat(r.oAmount),
        });
      }

      // Paid but order cancelled
      if (r.oStatus === 'cancelled') {
        mismatches.push({
          type: 'paid_but_cancelled',
          description: '支付成功但订单已取消（可能需退款）',
          orderId: r.orderId,
          amount: parseFloat(r.prAmount),
          transactionId: r.prTransactionId,
        });
      }

      // Transaction ID mismatch
      if (r.prTransactionId && r.oTransactionId && r.prTransactionId !== r.oTransactionId) {
        mismatches.push({
          type: 'transaction_id_mismatch',
          description: '交易号不一致',
          orderId: r.orderId,
          paymentTransactionId: r.prTransactionId,
          orderTransactionId: r.oTransactionId,
        });
      }
    }

    // Order-side orphans (paid via WeChat but no payment_record)
    for (const o of orderSide) {
      mismatches.push({
        type: 'order_no_payment',
        description: '订单标记已支付但无支付记录',
        orderId: o.orderId,
        amount: parseFloat(o.paid_amount),
        transactionId: o.transaction_id,
      });
    }

    const summary = {
      dateRange: { from: dateFrom, to: dateTo },
      totalPaymentRecords: paymentSide.length,
      totalPaidOrders: paymentSide.filter(r => r.oId).length,
      orphanPayments: paymentSide.filter(r => !r.oId).length,
      orphanOrders: orderSide.length,
      totalMismatches: mismatches.length,
    };

    log.info({ summary }, 'Reconciliation completed');

    return { summary, mismatches };
  },
};

module.exports = reconciliationService;
