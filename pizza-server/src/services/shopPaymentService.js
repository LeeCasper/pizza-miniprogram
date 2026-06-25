// src/services/shopPaymentService.js — 会员商城支付（WeChat + 余额）
const pool = require('../config/database');
const config = require('../config');
const { buildPayParams, payRequest } = require('../utils/wechatPay');
const { computeTier, getTierLevel } = require('../utils/memberTier');
const { createLogger } = require('../utils/logger');
const log = createLogger('ShopPay');
const auditService = require('./auditService');

const shopPaymentService = {
  // ── 1. 创建微信支付 ──────────────────────────────────
  /**
   * @param {number} userId
   * @param {string} shopOrderId
   * @param {string} openid
   * @returns {{ payParams, outTradeNo, recordId }}
   */
  async createShopWechatPayment(userId, shopOrderId, openid) {
    // 1. 验证订单
    const [[order]] = await pool.query(
      `SELECT id, paid_amount, payment_method, status
       FROM shop_orders WHERE id = ? AND user_id = ?`,
      [shopOrderId, userId]
    );
    if (!order) {
      throw Object.assign(new Error('订单不存在'), { statusCode: 404 });
    }
    if (order.status !== 'pending') {
      throw Object.assign(new Error('该订单状态无法支付'), { statusCode: 400 });
    }
    if (order.payment_method) {
      throw Object.assign(new Error('订单已支付，请勿重复支付'), { statusCode: 400 });
    }

    const amount = parseFloat(order.paid_amount);
    if (amount <= 0) {
      throw Object.assign(new Error('支付金额无效'), { statusCode: 400 });
    }

    const outTradeNo = shopOrderId;

    // 2. 幂等：检查现有支付记录
    const [[existing]] = await pool.query(
      'SELECT id, status FROM payment_records WHERE out_trade_no = ? AND type = ?',
      [outTradeNo, 'shop_order']
    );
    if (existing && existing.status === 'success') {
      throw Object.assign(new Error('该订单已完成支付'), { statusCode: 400 });
    }

    let recordId;
    if (existing) {
      recordId = existing.id;
      if (existing.status === 'failed' || existing.status === 'closed') {
        await pool.query(
          "UPDATE payment_records SET status = 'pending', updated_at = NOW() WHERE id = ?",
          [recordId]
        );
      }
    } else {
      const [result] = await pool.query(
        `INSERT INTO payment_records (user_id, type, reference_id, out_trade_no, amount, status)
         VALUES (?, 'shop_order', ?, ?, ?, 'pending')`,
        [userId, shopOrderId, outTradeNo, amount]
      );
      recordId = result.insertId;
    }

    // 3. 调用微信支付 JSAPI
    const notifyUrl = config.wxPay.notifyUrl;
    const wechatData = {
      appid: config.wx.appId,
      mchid: config.wxPay.mchId,
      description: `商城订单-${shopOrderId}`,
      out_trade_no: outTradeNo,
      notify_url: notifyUrl,
      amount: {
        total: Math.round(amount * 100),
        currency: 'CNY',
      },
      payer: { openid },
    };

    let prepayId;
    try {
      const resp = await payRequest('POST', '/v3/pay/transactions/jsapi', wechatData);
      prepayId = resp.prepay_id;
    } catch (err) {
      await pool.query(
        "UPDATE payment_records SET status = 'failed' WHERE id = ?",
        [recordId]
      );
      throw err;
    }

    const payParams = buildPayParams(prepayId);
    return { payParams, outTradeNo, recordId };
  },

  // ── 2. 余额支付（独立支付，非下单时） ─────────────────
  /**
   * 对已创建的 pending 订单用余额完成支付。
   */
  async payShopOrderWithBalance(userId, shopOrderId) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // 锁定用户
      const [[user]] = await conn.query(
        'SELECT balance FROM users WHERE id = ? FOR UPDATE', [userId]
      );
      if (!user) {
        await conn.rollback();
        throw Object.assign(new Error('用户不存在'), { statusCode: 404 });
      }
      const balance = parseFloat(user.balance);

      // 锁定订单
      const [[order]] = await conn.query(
        `SELECT id, paid_amount, payment_method, status
         FROM shop_orders WHERE id = ? AND user_id = ? FOR UPDATE`,
        [shopOrderId, userId]
      );
      if (!order) {
        await conn.rollback();
        throw Object.assign(new Error('订单不存在'), { statusCode: 404 });
      }
      if (order.status !== 'pending') {
        await conn.rollback();
        throw Object.assign(new Error('该订单状态无法支付'), { statusCode: 400 });
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

      const balanceAfter = +(balance - paidAmount).toFixed(2);
      await conn.query('UPDATE users SET balance = ? WHERE id = ?', [balanceAfter, userId]);
      try {
        await conn.query(
          'INSERT INTO balance_history (user_id, amount, balance_after, type, remark) VALUES (?, ?, ?, ?, ?)',
          [userId, paidAmount, balanceAfter, 'deduct', `商城订单支付 ${shopOrderId}`]
        );
      } catch (histErr) {
        log.warn({ err: histErr }, 'balance_history insert skipped');
      }

      await conn.query(
        `UPDATE shop_orders
         SET payment_method = 'balance', status = 'paid', paid_at = NOW(), updated_at = NOW()
         WHERE id = ?`,
        [shopOrderId]
      );

      await conn.query(
        `INSERT INTO payment_records (user_id, type, reference_id, out_trade_no, amount, status)
         VALUES (?, 'shop_order', ?, ?, ?, 'success')`,
        [userId, shopOrderId, shopOrderId, paidAmount]
      );

      await conn.commit();

      auditService.record({
        actorType: 'user',
        actorId: String(userId),
        action: 'shop_order.balance_paid',
        entityType: 'shop_order',
        entityId: shopOrderId,
        after: { amount: paidAmount, balanceAfter },
      }).catch(() => {});

      return { balanceBefore: balance, balanceAfter, paidAmount };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  // ── 3. 回调结算（由 handleNotify 调用） ──────────────
  /**
   * 在 paymentService.handleNotify 的事务内调用。
   * @param {object} conn — 活跃的数据库连接（事务中）
   * @param {object} record — payment_records 行
   * @param {string} transactionId — 微信交易单号
   */
  async settleShopOrder(conn, record, transactionId) {
    const [orderResult] = await conn.query(
      `UPDATE shop_orders
       SET payment_method = 'wechat', status = 'paid', paid_at = NOW(), updated_at = NOW()
       WHERE id = ? AND payment_method IS NULL`,
      [record.reference_id]
    );

    let detail = `shopOrder=${record.reference_id} updated=${orderResult.affectedRows}`;

    if (orderResult.affectedRows > 0) {
      // 积分奖励
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
          [record.user_id, earnedPoints, newPoints, '商城消费', record.reference_id]
        );

        detail += ` points=${earnedPoints} tier=${newTier}`;
      }
    }

    await auditService.record({
      actorType: 'system',
      action: 'shop_order.payment.success',
      entityType: 'shop_order',
      entityId: record.reference_id,
      after: { paymentMethod: 'wechat', amount: parseFloat(record.amount), transactionId },
    }, conn);

    return { success: true, detail };
  },

  // ── 4. 查询支付状态 ──────────────────────────────────
  async getShopOrderPaymentStatus(shopOrderId) {
    const [[record]] = await pool.query(
      "SELECT * FROM payment_records WHERE reference_id = ? AND type = 'shop_order'",
      [shopOrderId]
    );

    const [[order]] = await pool.query(
      'SELECT payment_method, status, paid_at FROM shop_orders WHERE id = ?',
      [shopOrderId]
    );

    return {
      status: record ? record.status : (order && order.payment_method ? 'success' : 'pending'),
      outTradeNo: record ? record.out_trade_no : shopOrderId,
      transactionId: record ? record.transaction_id : null,
      amount: record ? parseFloat(record.amount) : 0,
      paymentMethod: order ? order.payment_method : null,
      orderStatus: order ? order.status : null,
      paidAt: order ? order.paid_at : null,
    };
  },

  // ── 5. 从微信主动同步 ────────────────────────────────
  /**
   * 客户端轮询时，如果本地 still pending 但微信已成功，走这里同步。
   */
  async syncShopOrderFromWechat(shopOrderId, outTradeNo, transactionId) {
    const [[record]] = await pool.query(
      "SELECT * FROM payment_records WHERE out_trade_no = ? AND type = 'shop_order'",
      [outTradeNo]
    );
    if (!record) return { synced: false, detail: 'no_payment_record' };
    if (record.status === 'success') return { synced: false, detail: 'already_success' };

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [prResult] = await conn.query(
        "UPDATE payment_records SET status = 'success', transaction_id = ?, raw_notify = ?, updated_at = NOW() WHERE id = ? AND status = 'pending'",
        [transactionId, JSON.stringify({ syncedFromWechat: true, syncedAt: new Date().toISOString() }), record.id]
      );
      if (prResult.affectedRows === 0) {
        await conn.rollback();
        return { synced: false, detail: 'concurrent_skip' };
      }

      const result = await this.settleShopOrder(conn, record, transactionId);
      await conn.commit();
      log.info({ outTradeNo, detail: result.detail }, 'Synced shop order from WeChat');
      return { synced: true, detail: result.detail };
    } catch (err) {
      await conn.rollback();
      log.error({ err, outTradeNo }, 'SyncShopOrder TX error');
      throw err;
    } finally {
      conn.release();
    }
  },
};

module.exports = shopPaymentService;
