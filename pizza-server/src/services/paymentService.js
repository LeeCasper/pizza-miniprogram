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
      console.log(`[Payment] Already processed: ${outTradeNo}, type=${record.type}`);
      return { success: true, detail: `already_processed type=${record.type}` };
    }

    // Only process SUCCESS state
    if (tradeState !== 'SUCCESS') {
      const newStatus = tradeState === 'CLOSED' ? 'closed' : 'failed';
      await pool.query(
        "UPDATE payment_records SET status = ?, transaction_id = ?, raw_notify = ?, updated_at = NOW() WHERE id = ?",
        [newStatus, transactionId, JSON.stringify(notifyData), record.id]
      );
      console.log(`[Payment] Non-success state: ${outTradeNo} → ${newStatus}`);
      return { success: true, reason: `trade_state_${tradeState}`, detail: `state=${tradeState} type=${record.type}` };
    }

    // Begin transaction for atomic update
    const conn = await pool.getConnection();
    const txStart = Date.now();
    let detail = '';
    try {
      await conn.beginTransaction();

      // Update payment record
      const [prResult] = await conn.query(
        "UPDATE payment_records SET status = 'success', transaction_id = ?, raw_notify = ?, updated_at = NOW() WHERE id = ? AND status = 'pending'",
        [transactionId, JSON.stringify(notifyData), record.id]
      );
      if (prResult.affectedRows === 0) {
        // Another concurrent handler already processed this — idempotent exit
        await conn.rollback();
        console.log(`[Payment] Race: already processed by concurrent handler: ${outTradeNo}`);
        return { success: true, detail: `concurrent_skip type=${record.type}` };
      }

      if (record.type === 'order') {
        // Update order: set payment_method and paid_at
        const [orderResult] = await conn.query(
          "UPDATE orders SET payment_method = 'wechat', transaction_id = ?, paid_at = NOW(), updated_at = NOW() WHERE id = ? AND payment_method IS NULL",
          [transactionId, record.reference_id]
        );

        detail = `order=${record.reference_id} orderUpdated=${orderResult.affectedRows}`;

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

            detail += ` points=${earnedPoints} tier=${newTier} totalSpent=${newTotalSpent.toFixed(2)}`;
            console.log(`[Payment] Order processed: user=${record.user_id} points+${earnedPoints} tier=${newTier}`);
          }
        } else {
          detail += ' orderAlreadyPaid';
        }
      } else if (record.type === 'recharge') {
        // Add balance to user + update growth progress (total_spent)
        const amount = parseFloat(record.amount);
        const [[user]] = await conn.query(
          'SELECT balance, total_spent FROM users WHERE id = ? FOR UPDATE', [record.user_id]
        );
        if (user) {
          const oldBalance = parseFloat(user.balance);
          const balanceAfter = oldBalance + amount;
          await conn.query('UPDATE users SET balance = ? WHERE id = ?', [balanceAfter, record.user_id]);
          // Recharge amount counts toward growth progress
          const oldTotalSpent = parseFloat(user.total_spent || 0);
          const newTotalSpent = oldTotalSpent + amount;
          const newTier = await getTierLevel(newTotalSpent);
          await conn.query('UPDATE users SET total_spent = ?, member_level = ? WHERE id = ?',
            [newTotalSpent.toFixed(2), newTier, record.user_id]);
          try {
            await conn.query(
              'INSERT INTO balance_history (user_id, amount, balance_after, type, remark) VALUES (?, ?, ?, ?, ?)',
              [record.user_id, amount, balanceAfter, 'recharge', '微信支付充值']
            );
          } catch (histErr) {
            console.warn(`[Payment] balance_history insert skipped (notify): ${histErr.message}`);
          }
          detail = `recharge user=${record.user_id} amount=${amount} balance=${oldBalance}→${balanceAfter} totalSpent=${oldTotalSpent}→${newTotalSpent.toFixed(2)} tier=${newTier}`;
        }
      }

      await conn.commit();
      const txElapsed = Date.now() - txStart;
      console.log(`[Payment] Processed (${txElapsed}ms): ${outTradeNo}, type=${record.type} — ${detail}`);

      // 微信支付成功后触发打印机（异步，不阻塞回调响应）
      if (record.type === 'order' && require('../config').printer.enabled) {
        const orderService = require('./orderService');
        const printerService = require('./printerService');
        orderService.findById(record.reference_id).then(order => {
          if (order) {
            printerService.printOrderTicket(order).catch(err => {
              console.error('[Printer] 打印失败:', err.message);
            });
          }
        });
      }

      return { success: true, detail };
    } catch (err) {
      await conn.rollback();
      console.error(`[Payment] Notify TX error (${Date.now() - txStart}ms): ${outTradeNo} —`, err.message);
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

  // ── 5a. Query recharge payment status ─────────────────────────────

  /**
   * Get local payment status for a recharge by out_trade_no.
   *
   * @param {string} outTradeNo
   * @returns {object|null}
   */
  async getRechargePaymentStatus(outTradeNo) {
    const [[record]] = await pool.query(
      "SELECT * FROM payment_records WHERE out_trade_no = ? AND type = 'recharge'",
      [outTradeNo]
    );
    if (!record) return null;

    // Also check balance_history as secondary confirmation.
    // If the WeChat callback arrived and processed the recharge,
    // balance_history will have a row even if payment_records
    // is delayed (rare race condition).
    let balanceUpdated = false;
    if (record.status !== 'success') {
      try {
        const [[bh]] = await pool.query(
          "SELECT id FROM balance_history WHERE user_id = ? AND type = 'recharge' AND amount = ? ORDER BY id DESC LIMIT 1",
          [record.user_id, parseFloat(record.amount)]
        );
        balanceUpdated = !!bh;
      } catch (_) {
        // Table may not exist yet — ignore
      }
    }

    return {
      status: record.status,
      outTradeNo: record.out_trade_no,
      transactionId: record.transaction_id,
      amount: parseFloat(record.amount),
      userId: record.user_id,
      balanceUpdated,
    };
  },

  /**
   * Sync recharge payment from a WeChat query result.
   * Called when queryWechatOrder() returns SUCCESS for a recharge
   * but the local DB still shows pending.
   *
   * @param {string} outTradeNo
   * @param {string} transactionId - from WeChat query result
   * @returns {{ synced: boolean, detail: string }}
   */
  async syncRechargeFromWechat(outTradeNo, transactionId) {
    const [[record]] = await pool.query(
      "SELECT * FROM payment_records WHERE out_trade_no = ? AND type = 'recharge'",
      [outTradeNo]
    );
    if (!record) {
      return { synced: false, detail: 'no_payment_record' };
    }
    if (record.status === 'success') {
      return { synced: false, detail: 'already_success' };
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Update payment record (with race-condition guard)
      const [prResult] = await conn.query(
        "UPDATE payment_records SET status = 'success', transaction_id = ?, raw_notify = ?, updated_at = NOW() WHERE id = ? AND status = 'pending'",
        [transactionId, JSON.stringify({ syncedFromWechat: true, syncedAt: new Date().toISOString() }), record.id]
      );
      if (prResult.affectedRows === 0) {
        await conn.rollback();
        return { synced: false, detail: 'concurrent_skip' };
      }

      // Add balance to user + update growth progress (total_spent)
      const amount = parseFloat(record.amount);
      const [[user]] = await conn.query(
        'SELECT balance, total_spent FROM users WHERE id = ? FOR UPDATE', [record.user_id]
      );
      let detail = '';
      if (user) {
        const oldBalance = parseFloat(user.balance);
        const balanceAfter = oldBalance + amount;
        await conn.query('UPDATE users SET balance = ? WHERE id = ?', [balanceAfter, record.user_id]);
        // Recharge amount counts toward growth progress
        const oldTotalSpent = parseFloat(user.total_spent || 0);
        const newTotalSpent = oldTotalSpent + amount;
        const newTier = await getTierLevel(newTotalSpent);
        await conn.query('UPDATE users SET total_spent = ?, member_level = ? WHERE id = ?',
          [newTotalSpent.toFixed(2), newTier, record.user_id]);
        // balance_history insert is best-effort — won't rollback if table missing
        try {
          await conn.query(
            'INSERT INTO balance_history (user_id, amount, balance_after, type, remark) VALUES (?, ?, ?, ?, ?)',
            [record.user_id, amount, balanceAfter, 'recharge', '微信支付充值']
          );
        } catch (histErr) {
          console.warn(`[Payment] balance_history insert skipped: ${histErr.message}`);
        }
        detail = `recharge user=${record.user_id} amount=${amount} balance=${oldBalance}→${balanceAfter} totalSpent=${oldTotalSpent}→${newTotalSpent.toFixed(2)} tier=${newTier}`;
      }

      await conn.commit();
      console.log(`[Payment] Synced recharge from WeChat: ${outTradeNo} — ${detail}`);
      return { synced: true, detail };
    } catch (err) {
      await conn.rollback();
      console.error(`[Payment] SyncRecharge TX error: ${outTradeNo} —`, err.message);
      throw err;
    } finally {
      conn.release();
    }
  },

  // ── 5b. Sync order payment from WeChat query result ────────────────

  /**
   * Sync order payment status from a WeChat Pay query result.
   * Called when queryWechatOrder() returns SUCCESS but the local DB
   * still shows pending — this fixes the race condition where the
   * client polls before the WeChat callback arrives.
   *
   * Mirrors the order-handling logic in handleNotify().
   *
   * @param {string} orderId
   * @param {string} outTradeNo
   * @param {string} transactionId - from WeChat query result
   * @returns {{ synced: boolean, detail: string }}
   */
  async syncOrderFromWechat(orderId, outTradeNo, transactionId) {
    // Look up the payment record
    const [[record]] = await pool.query(
      'SELECT * FROM payment_records WHERE out_trade_no = ? AND type = ?',
      [outTradeNo, 'order']
    );
    if (!record) {
      return { synced: false, detail: 'no_payment_record' };
    }
    if (record.status === 'success') {
      return { synced: false, detail: 'already_success' };
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Update payment record (with race-condition guard)
      const [prResult] = await conn.query(
        "UPDATE payment_records SET status = 'success', transaction_id = ?, raw_notify = ?, updated_at = NOW() WHERE id = ? AND status = 'pending'",
        [transactionId, JSON.stringify({ syncedFromWechat: true, syncedAt: new Date().toISOString() }), record.id]
      );
      if (prResult.affectedRows === 0) {
        await conn.rollback();
        return { synced: false, detail: 'concurrent_skip' };
      }

      // Update order
      const [orderResult] = await conn.query(
        "UPDATE orders SET payment_method = 'wechat', transaction_id = ?, paid_at = NOW(), updated_at = NOW() WHERE id = ? AND payment_method IS NULL",
        [transactionId, orderId]
      );

      let detail = `order=${orderId} orderUpdated=${orderResult.affectedRows}`;

      // Award points + update tier (only if order was actually updated)
      if (orderResult.affectedRows > 0) {
        const [[userData]] = await conn.query(
          'SELECT total_spent, points, member_level FROM users WHERE id = ? FOR UPDATE',
          [record.user_id]
        );
        if (userData) {
          const oldTotalSpent = parseFloat(userData.total_spent || 0);
          const oldPoints = userData.points || 0;
          const paidAmount = parseFloat(record.amount);

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
            [record.user_id, earnedPoints, newPoints, '订单消费', orderId]
          );

          detail += ` points=${earnedPoints} tier=${newTier} totalSpent=${newTotalSpent.toFixed(2)}`;
        }
      } else {
        detail += ' orderAlreadyPaid';
      }

      await conn.commit();
      console.log(`[Payment] Synced from WeChat: ${outTradeNo} — ${detail}`);

      // 主动同步成功后也触发打印机
      if (require('../config').printer.enabled) {
        const orderService = require('./orderService');
        const printerService = require('./printerService');
        orderService.findById(orderId).then(order => {
          if (order) {
            printerService.printOrderTicket(order).catch(err => {
              console.error('[Printer] 打印失败:', err.message);
            });
          }
        });
      }

      return { synced: true, detail };
    } catch (err) {
      await conn.rollback();
      console.error(`[Payment] SyncOrder TX error: ${outTradeNo} —`, err.message);
      throw err;
    } finally {
      conn.release();
    }
  },

  // ── 6. Admin: list payment records ─────────────────────────────────

  /**
   * Admin query: list all payment records with user info.
   *
   * @param {object} opts - { type, status, page, limit }
   * @returns {object} { list, total }
   */
  async adminList({ type, status, page = 1, limit = 20 } = {}) {
    let sql = `SELECT pr.*, u.name AS user_name, u.phone AS user_phone
               FROM payment_records pr
               JOIN users u ON pr.user_id = u.id`;
    const conditions = [];
    const params = [];

    if (type && type !== 'all') {
      conditions.push('pr.type = ?');
      params.push(type);
    }
    if (status && status !== 'all') {
      conditions.push('pr.status = ?');
      params.push(status);
    }
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY pr.created_at DESC';

    // Count total
    const countSql = sql.replace(/SELECT .* FROM/, 'SELECT COUNT(*) AS total FROM');
    const [[{ total }]] = await pool.query(countSql, params);

    // Paginate
    const offset = (page - 1) * limit;
    const [rows] = await pool.query(sql + ' LIMIT ? OFFSET ?', [...params, limit, offset]);

    return {
      list: rows.map(formatPaymentRecord),
      total,
    };
  },

  /**
   * Admin query: get single payment record by ID.
   */
  async adminGetById(id) {
    const [[row]] = await pool.query(
      `SELECT pr.*, u.name AS user_name, u.phone AS user_phone
       FROM payment_records pr
       JOIN users u ON pr.user_id = u.id
       WHERE pr.id = ?`,
      [id]
    );
    return row ? formatPaymentRecord(row) : null;
  },

  // ── 7. Balance payment for order ───────────────────────────────────

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

function formatPaymentRecord(row) {
  return row ? {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name || null,
    userPhone: row.user_phone || null,
    type: row.type,
    referenceId: row.reference_id,
    outTradeNo: row.out_trade_no,
    transactionId: row.transaction_id || null,
    amount: parseFloat(row.amount),
    status: row.status,
    rawNotify: row.raw_notify || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  } : null;
}

module.exports = paymentService;
