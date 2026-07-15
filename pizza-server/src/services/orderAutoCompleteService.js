// src/services/orderAutoCompleteService.js — Auto-mark orders as completed after pickup_time + 20 min
const pool = require('../config/database');
const { createLogger } = require('../utils/logger');
const auditService = require('./auditService');

const log = createLogger('AutoComplete');

const AUTO_COMPLETE_MINUTES = 20; // minutes after pickup_time to auto-complete

const orderAutoCompleteService = {
  async autoCompleteOrders() {
    const [rows] = await pool.query(
      `SELECT id, user_id, pickup_code, store_name FROM orders
       WHERE pickup_time IS NOT NULL
         AND status IN ('waiting', 'preparing')
         AND pickup_time < NOW() - INTERVAL ? MINUTE`,
      [AUTO_COMPLETE_MINUTES]
    );

    if (rows.length === 0) return 0;

    let completed = 0;
    for (const order of rows) {
      try {
        const [result] = await pool.query(
          `UPDATE orders SET status = 'completed', updated_at = NOW()
           WHERE id = ? AND status IN ('waiting', 'preparing')`,
          [order.id]
        );
        if (result.affectedRows === 0) continue;

        const notificationService = require('./notificationService');
        notificationService.notifyOrderStatus({ user_id: order.user_id, id: order.id, status: 'completed', pickup_code: order.pickup_code, store_name: order.store_name, pickup_time: order.pickup_time, paid_amount: order.paid_amount }).catch(() => {});

        await auditService.record({
          actorType: 'system',
          action: 'order.auto_completed',
          entityType: 'order',
          entityId: order.id,
          after: { status: 'completed' },
          metadata: { reason: `pickup_time + ${AUTO_COMPLETE_MINUTES} min` },
        });

        completed++;
      } catch (err) {
        log.error({ err, orderId: order.id }, 'Auto-complete order failed');
      }
    }

    return completed;
  },
};

module.exports = orderAutoCompleteService;
