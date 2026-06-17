/**
 * Payment Service
 *
 * Handles WeChat Pay v3 JSAPI payment creation, callback processing,
 * and balance-based payment for orders.
 */

const pool = require('../config/database');
const config = require('../config');
const { buildPayParams, generateOutTradeNo, payRequest, decryptNotify } = require('../utils/wechatPay');
const { computeTier, getTierLevel } = require('../utils/memberTier');

const paymentService = {

  // ── 1. Create WeChat Pay for an existing order ─────────────────────

  /**
   * Create a WeChat Pay JSAPI prepay session for an order.
   *
   * @param {number} userId
   * @param {string} orderId   - Existing order ID (also used as out_trade_no)
   * @param {string} openid    - User's WeChat openid (required for JSAPI)
   * @returns {{ payParams, outTradeNo }} data for wx.requestPayment()
   */
  async createOrderPayment(userId, orderId, openid) {
    // 1. Verify order exists and belongs to user
    const [[order]] = await pool.query(
      'SELECT id, paid_amount, payment_method FROM orders WHERE id = ? AND user_id = ?',
      [orderId, userId]
    );
    if (!order) {
      throw Object.assign(new Error('订单不存在'), { statusCode: 404 });
    }
    if (order.payment_method) {
      throw Object.assign(new Error('订单已支付，请勿重复支付'), { statusCode: 400 });
    }

    const amount = parseFloat(order.paid_amount);
    if (amount <= 0) {
      throw Object.assign(new Error('支付金额无效'), { statusCode: 400 });
    }

    const outTradeNo = orderId;

    // 2. Check for existing pending payment record (idempotency)
    const [[existing]] = await pool.query(
      "SELECT id, status FROM payment_records WHERE out_trade_no = ?",
      [outTradeNo]
    );
    if (existing && existing.status === 'success') {
      throw Object.assign(new Error('该订单已完成支付'), { statusCode: 400 });
    }

    // 3. Create or reuse payment record
    let recordId;
    if (existing) {
      recordId = existing.id;
      // Reset failed/closed records to pending for re-payment
      if (existing.status === 'failed' || existing.status === 'closed') {
        await pool.query(
          "UPDATE payment_records SET status = 'pending', updated_at = NOW() WHERE id = ?",
          [recordId]
        );
      }
    } else {
      const [result] = await pool.query(
        `INSERT INTO payment_records (user_id, type, reference_id, out_trade_no, amount, status)
         VALUES (?, 'order', ?, ?, ?, 'pending')`,
        [userId, orderId, outTradeNo, amount]
      );
      recordId = result.insertId;
    }

    // 4. Call WeChat Pay JSAPI to get prepay_id
    const notifyUrl = config.wxPay.notifyUrl;
    const wechatData = {
      appid: config.wx.appId,
      mchid: config.wxPay.mchId,
      description: `披萨订单-${orderId}`,
      out_trade_no: outTradeNo,
      notify_url: notifyUrl,
      amount: {
        total: Math.round(amount * 100), // in cents
        currency: 'CNY',
      },
      payer: {
        openid,
      },
    };

    let prepayId;
    try {
      const resp = await payRequest('POST', '/v3/pay/transactions/jsapi', wechatData);
      prepayId = resp.prepay_id;
    } catch (err) {
      // Mark record as failed so user can retry
      await pool.query(
        "UPDATE payment_records SET status = 'failed' WHERE id = ?",
        [recordId]
      );
      throw err;
    }

    // 5. Build params for wx.requestPayment()
    const payParams = buildPayParams(prepayId);

    return { payParams, outTradeNo, recordId };
  },

  // ── 2. Create WeChat Pay for balance recharge ──────────────────────

  /**
   * Create a WeChat Pay JSAPI prepay session for balance recharge.
   *
   * @param {number} userId
   * @param {number} amount   - Recharge amount (RMB)
   * @param {string} openid   - User's WeChat openid
   * @returns {{ payParams, outTradeNo }}
   */
  async createRechargePayment(userId, amount, openid) {
    if (!amount || amount <= 0 || amount > 5000) {
      throw Object.assign(new Error('充值金额无效（1-5000元）'), { statusCode: 400 });
    }

    const outTradeNo = generateOutTradeNo('recharge');

    // Insert payment record
    const [result] = await pool.query(
      `INSERT INTO payment_records (user_id, type, reference_id, out_trade_no, amount, status)
       VALUES (?, 'recharge', ?, ?, ?, 'pending')`,
      [userId, outTradeNo, outTradeNo, amount]
    );

    // Call WeChat Pay JSAPI
    const notifyUrl = config.wxPay.notifyUrl;
    const wechatData = {
      appid: config.wx.appId,
      mchid: config.wxPay.mchId,
      description: '余额充值',
      out_trade_no: outTradeNo,
      notify_url: notifyUrl,
      amount: {
        total: Math.round(amount * 100),
        currency: 'CNY',
      },
      payer: {
        openid,
      },
    };

    let prepayId;
    try {
      const resp = await payRequest('POST', '/v3/pay/transactions/jsapi', wechatData);
      prepayId = resp.prepay_id;
    } catch (err) {
      await pool.query("UPDATE payment_records SET status = 'failed' WHERE id = ?", [result.insertId]);
      throw err;
    }

    const payParams = buildPayParams(prepayId);

    return { payParams, outTradeNo, recordId: result.insertId };
  },

  // ── 3. Handle WeChat Pay callback notification ─────────────────────

  /**
   * Process WeChat Pay callback notification.
   *
   * Steps:
   *   1. Parse the raw JSON body
   *   2. Decrypt the resource ciphertext
   *   3. Look up payment_records by out_trade_no
   *   4. Update payment_records status (idempotent)
   *   5. Update orders table (if order payment)
   *   6. Update users balance (if recharge payment)
   *
   * @param {string} rawBody - Raw request body JSON string
   * @returns {{ success: boolean }}
   */
  async handleNotify(rawBody) {
    const notifyData = JSON.parse(rawBody);
    const resource = notifyData.resource;

    // Decrypt the notification body
    const decrypted = decryptNotify(
      resource.ciphertext,
      resource.associated_data,
      resource.nonce
    );

    const outTradeNo = decrypted.out_trade_no;
    const transactionId = decrypted.transaction_id;
    const tradeState = decrypted.trade_state; // SUCCESS, NOTPAY, CLOSED, etc.

    console.log(`[Payment] Notify: out_trade_no=${outTradeNo}, state=${tradeState}, txn=${transactionId}`);

    // Look up payment record
    const [[record]] = await pool.query(
      'SELECT * FROM payment_records WHERE out_trade_no = ?',
      [outTradeNo]
    );
    if (!record) {
      console.error(`[Payment] Unknown out_trade_no: ${outTradeNo}`);
      return { success: false, reason: 'unknown_out_trade_no' };
    }

    // Idempotency: already processed
    if (record.status === 'success') {
      console.log(`[Payment] Already processed: ${outTradeNo}`);
      return { success: true };
    }

    // Only process SUCCESS state
    if (tradeState !== 'SUCCESS') {
      await pool.query(
        "UPDATE payment_records SET status = ?, transaction_id = ?, raw_notify = ?, updated_at = NOW() WHERE id = ?",
        [tradeState === 'CLOSED' ? 'closed' : 'failed', transactionId, JSON.stringify(notifyData), record.id]
      );
      return { success: true, reason: `trade_state_${tradeState}` };
    }

    // Begin transaction for atomic update
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Update payment record
      await conn.query(
        "UPDATE payment_records SET status = 'success', transaction_id = ?, raw_notify = ?, updated_at = NOW() WHERE id = ? AND status = 'pending'",
        [transactionId, JSON.stringify(notifyData), record.id]
      );

      if (record.type === 'order') {
        // Update order: set payment_method and paid_at
        const [orderResult] = await conn.query(
          "UPDATE orders SET payment_method = 'wechat', transaction_id = ?, paid_at = NOW(), updated_at = NOW() WHERE id = ? AND payment_method IS NULL",
          [transactionId, record.reference_id]
        );

        // Award points + increment total_spent + update membership tier
        // Only if the order was actually updated (not already paid via another path)
        if (orderResult.affectedRows > 0) {
          // Lock user row to prevent race conditions
          const [[userData]] = await conn.query(
            'SELECT total_spent, points, member_level FROM users WHERE id = ? FOR UPDATE',
            [record.user_id]
          );
          if (userData) {
            const oldTotalSpent = parseFloat(userData.total_spent || 0);
            const oldPoints = userData.points || 0;
            const paidAmount = parseFloat(record.amount);

            // Compute points based on current tier multiplier
            const tier = await computeTier(oldTotalSpent);
            const multiplier = parseFloat(tier.pointsRewardRate || 1);
            const earnedPoints = Math.floor(paidAmount * multiplier);

            const newTotalSpent = oldTotalSpent + paidAmount;
            const newPoints = oldPoints + earnedPoints;
            const newTier = await getTierLevel(newTotalSpent);

            await conn.query(
              'UPDATE users SET total_spent = ?, points = ?, member_level = ? WHERE id = ?',
              [newTotalSpent.toFixed(2), newPoints, newTier, record.user_id]
            );
            await conn.query(
              'INSERT INTO points_history (user_id, points_change, balance_after, reason, reference_id) VALUES (?, ?, ?, ?, ?)',
              [record.user_id, earnedPoints, newPoints, '订单消费', record.reference_id]
            );

            console.log(`[Payment] Awarded ${earnedPoints} points to user ${record.user_id}, tier=${newTier}`);
          }
        }
      } else if (record.type === 'recharge') {
        // Add balance to user
        const amount = parseFloat(record.amount);
        const [[user]] = await conn.query('SELECT balance FROM users WHERE id = ?', [record.user_id]);
        if (user) {
          const balanceAfter = parseFloat(user.balance) + amount;
          await conn.query('UPDATE users SET balance = ? WHERE id = ?', [balanceAfter, record.user_id]);
          await conn.query(
            'INSERT INTO balance_history (user_id, amount, balance_after, type, remark) VALUES (?, ?, ?, ?, ?)',
            [record.user_id, amount, balanceAfter, 'recharge', '微信支付充值']
          );
        }
      }

      await conn.commit();
      console.log(`[Payment] Processed: ${outTradeNo}, type=${record.type}`);
      return { success: true };
    } catch (err) {
      await conn.rollback();
      console.error('[Payment] Notify processing error:', err.message);
      throw err;
    } finally {
      conn.release();
    }
  },

  // ── 4. Query WeChat Pay order status ────────────────────────────────

  /**
   * Query WeChat Pay order status by out_trade_no.
   * Used for active polling when notification fails or user needs confirmation.
   *
   * @param {string} outTradeNo
   * @returns {object} WeChat Pay order data
   */
  async queryWechatOrder(outTradeNo) {
    const path = `/v3/pay/transactions/out-trade-no/${encodeURIComponent(outTradeNo)}`;
    return payRequest('GET', path + '?mchid=' + config.wxPay.mchId);
  },

  // ── 5. Query local payment status ──────────────────────────────────

  /**
   * Get local payment status for an order.
   *
   * @param {string} orderId
   * @returns {object|null}
   */
  async getOrderPaymentStatus(orderId) {
    const [[record]] = await pool.query(
      "SELECT * FROM payment_records WHERE reference_id = ? AND type = 'order'",
      [orderId]
    );
    if (!record) return null;

    // Also check order's own payment fields
    const [[order]] = await pool.query(
      'SELECT payment_method, transaction_id, paid_at FROM orders WHERE id = ?',
      [orderId]
    );

    return {
      status: record.status,
      outTradeNo: record.out_trade_no,
      transactionId: record.transaction_id,
      amount: parseFloat(record.amount),
      paymentMethod: order ? order.payment_method : null,
      paidAt: order ? order.paid_at : null,
    };
  },

  // ── 6. Balance payment for order ───────────────────────────────────

  /**
   * Pay an order using account balance (no WeChat Pay involved).
   *
   * @param {number} userId
   * @param {string} orderId
   * @returns {{ balanceBefore, balanceAfter, paidAmount }}
   */
  async payOrderWithBalance(userId, orderId) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Lock the user row
      const [[user]] = await conn.query(
        'SELECT balance FROM users WHERE id = ? FOR UPDATE', [userId]
      );
      if (!user) {
        await conn.rollback();
        throw Object.assign(new Error('用户不存在'), { statusCode: 404 });
      }

      const balance = parseFloat(user.balance);

      // Verify order
      const [[order]] = await conn.query(
        'SELECT id, paid_amount, payment_method FROM orders WHERE id = ? AND user_id = ? FOR UPDATE',
        [orderId, userId]
      );
      if (!order) {
        await conn.rollback();
        throw Object.assign(new Error('订单不存在'), { statusCode: 404 });
      }
      if (order.payment_method) {
        await conn.rollback();
        throw Object.assign(new Error('订单已支付'), { statusCode: 400 });
      }

      const paidAmount = parseFloat(order.paid_amount);
      if (balance < paidAmount) {
        await conn.rollback();
        throw Object.assign(
          new Error(`余额不足，还需 ¥${(paidAmount - balance).toFixed(2)}`),
          { statusCode: 400, code: 'INSUFFICIENT_BALANCE' }
        );
      }

      const balanceAfter = balance - paidAmount;

      // Deduct balance
      await conn.query('UPDATE users SET balance = ? WHERE id = ?', [balanceAfter, userId]);

      // Record in balance_history
      await conn.query(
        'INSERT INTO balance_history (user_id, amount, balance_after, type, remark) VALUES (?, ?, ?, ?, ?)',
        [userId, paidAmount, balanceAfter, 'deduct', `订单支付 ${orderId}`]
      );

      // Update order payment info
      await conn.query(
        "UPDATE orders SET payment_method = 'balance', paid_at = NOW(), updated_at = NOW() WHERE id = ?",
        [orderId]
      );

      // Insert payment_records entry
      await conn.query(
        `INSERT INTO payment_records (user_id, type, reference_id, out_trade_no, amount, status)
         VALUES (?, 'order', ?, ?, ?, 'success')`,
        [userId, orderId, orderId, paidAmount]
      );

      await conn.commit();

      return {
        balanceBefore: balance,
        balanceAfter,
        paidAmount,
      };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },
};

module.exports = paymentService;
