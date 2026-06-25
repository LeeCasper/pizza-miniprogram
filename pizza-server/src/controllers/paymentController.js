const paymentService = require('../services/paymentService');
const userService = require('../services/userService');
const refundService = require('../services/refundService');
const { verifyNotifySign } = require('../utils/wechatPay');
const pool = require('../config/database');
const { createLogger } = require('../utils/logger');
const log = createLogger('Payment');

const paymentController = {

  /**
   * POST /api/v1/pay/order
   * Create WeChat Pay prepay session for an unpaid order.
   * Body: { orderId }
   */
  async createOrderPayment(req, res, next) {
    try {
      const { orderId } = req.body;
      if (!orderId) {
        return res.status(400).json({ code: 400, message: '缺少订单号' });
      }

      // Get user's openid
      const user = await userService.findById(req.user.id);
      if (!user || !user.openid) {
        return res.status(400).json({ code: 400, message: '用户信息不完整' });
      }

      const { payParams, outTradeNo } = await paymentService.createOrderPayment(
        req.user.id, orderId, user.openid
      );

      res.json({
        code: 0,
        data: { payParams, outTradeNo },
        message: '预支付创建成功',
      });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ code: err.statusCode, message: err.message });
      }
      next(err);
    }
  },

  /**
   * POST /api/v1/pay/recharge
   * Create WeChat Pay prepay session for balance recharge.
   * Body: { amount }
   */
  async createRechargePayment(req, res, next) {
    try {
      const amount = parseFloat(req.body.amount);
      if (!amount || amount <= 0 || amount > 5000) {
        return res.status(400).json({ code: 400, message: '充值金额无效（1-5000元）' });
      }

      const user = await userService.findById(req.user.id);
      if (!user || !user.openid) {
        return res.status(400).json({ code: 400, message: '用户信息不完整' });
      }

      const { payParams, outTradeNo } = await paymentService.createRechargePayment(
        req.user.id, amount, user.openid
      );

      res.json({
        code: 0,
        data: { payParams, outTradeNo },
        message: '充值预支付创建成功',
      });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ code: err.statusCode, message: err.message });
      }
      next(err);
    }
  },

  /**
   * POST /api/v1/pay/notify
   * WeChat Pay callback notification (no JWT auth required).
   * Uses express.raw() — the body is a Buffer.
   */
  async notify(req, res, next) {
    const startTime = Date.now();
    try {
      // req.body is a Buffer when using express.raw({type: 'application/json'})
      const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : req.body;
      const bodyLen = rawBody.length;

      log.info({ bodyLen }, 'notify callback received');

      // Verify WeChat Pay signature before processing
      const signHeaders = {
        serial: req.headers['wechatpay-serial'] || 'MISSING',
        timestamp: req.headers['wechatpay-timestamp'] || 'MISSING',
        nonce: req.headers['wechatpay-nonce'] || 'MISSING',
      };
      log.info({ serial: signHeaders.serial, timestamp: signHeaders.timestamp }, 'notify headers');

      if (!verifyNotifySign(req.headers, rawBody)) {
        const elapsed = Date.now() - startTime;
        log.error({ elapsedMs: elapsed, serial: signHeaders.serial, timestamp: signHeaders.timestamp, nonce: signHeaders.nonce ? 'present' : 'MISSING' }, 'notify signature FAILED');
        // Still return 200 to prevent WeChat Pay retry storms
        return res.status(200).json({ code: 'FAIL', message: 'Signature verification failed' });
      }
      log.info({ elapsedMs: Date.now() - startTime }, 'notify signature verified');

      const result = await paymentService.handleNotify(rawBody);

      const totalElapsed = Date.now() - startTime;
      // Always return 200 to WeChat Pay (even on error) to prevent retry
      if (result.success) {
        log.info({ elapsedMs: totalElapsed, detail: result.detail }, 'notify SUCCESS');
        res.status(200).json({ code: 'SUCCESS', message: 'OK' });
      } else {
        // Still 200 — WeChat requires HTTP 200, but we signal failure
        // in the response body so we can debug
        log.error({ elapsedMs: totalElapsed, reason: result.reason }, 'notify FAILED');
        res.status(200).json({ code: 'SUCCESS', message: 'OK' });
      }
    } catch (err) {
      const elapsed = Date.now() - startTime;
      log.error({ err, elapsedMs: elapsed }, 'notify exception');
      // MUST return 200 to WeChat Pay regardless
      res.status(200).json({ code: 'SUCCESS', message: 'OK' });
    }
  },

  /**
   * GET /api/v1/pay/order/:orderId/status
   * Query payment status for an order.
   */
  async orderPaymentStatus(req, res, next) {
    try {
      const { orderId } = req.params;

      // Verify order ownership — prevent IDOR
      const [[order]] = await pool.query('SELECT user_id FROM orders WHERE id = ?', [orderId]);
      if (!order || order.user_id !== req.user.id) {
        return res.status(403).json({ code: 403, message: '无权查看此订单' });
      }

      const status = await paymentService.getOrderPaymentStatus(orderId);

      if (!status) {
        return res.json({
          code: 0,
          data: { status: 'unpaid', message: '订单未发起支付' },
        });
      }

      // If pending, try querying WeChat Pay to sync
      if (status.status === 'pending') {
        try {
          const wxResult = await paymentService.queryWechatOrder(status.outTradeNo);
          if (wxResult.trade_state === 'SUCCESS') {
            // Sync DB state from WeChat result
            const syncResult = await paymentService.syncOrderFromWechat(
              orderId, status.outTradeNo, wxResult.transaction_id
            );
            if (syncResult.synced) {
              status.status = 'success';
              status.transactionId = wxResult.transaction_id;
            }
          }
        } catch (_) {
          // WeChat query failed — return local state
        }
      }

      res.json({ code: 0, data: status });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/v1/pay/recharge/:outTradeNo/status
   * Query recharge payment status — used for client-side polling after
   * wx.requestPayment succeeds.
   */
  async rechargePaymentStatus(req, res, next) {
    try {
      const { outTradeNo } = req.params;

      // Verify recharge ownership — prevent IDOR
      const [[record]] = await pool.query('SELECT user_id FROM payment_records WHERE out_trade_no = ?', [outTradeNo]);
      if (!record || record.user_id !== req.user.id) {
        return res.status(403).json({ code: 403, message: '无权查看此充值记录' });
      }

      const status = await paymentService.getRechargePaymentStatus(outTradeNo);

      if (!status) {
        return res.json({
          code: 0,
          data: { status: 'unpaid', message: '充值记录不存在' },
        });
      }

      // If pending, try querying WeChat Pay to sync
      if (status.status === 'pending') {
        try {
          const wxResult = await paymentService.queryWechatOrder(outTradeNo);
          if (wxResult.trade_state === 'SUCCESS') {
            // Sync DB state from WeChat result
            const syncResult = await paymentService.syncRechargeFromWechat(
              outTradeNo, wxResult.transaction_id
            );
            if (syncResult.synced) {
              status.status = 'success';
              status.transactionId = wxResult.transaction_id;
            }
          }
        } catch (_) {
          // WeChat query failed — return local state
        }
      }

      res.json({ code: 0, data: status });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/v1/orders
   * This is handled by orderController — but we proxy balance payment here.
   * The order controller calls this when paymentMethod === 'balance'.
   * (Implemented inline in orderController, not here.)
   */

  /**
   * POST /api/v1/pay/refund-notify
   * WeChat Pay refund callback notification (no JWT auth required).
   * Uses express.raw() — the body is a Buffer.
   */
  async refundNotify(req, res) {
    const startTime = Date.now();
    try {
      const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : req.body;
      log.info({ bodyLen: rawBody.length }, 'refund notify callback received');

      // Verify signature
      if (!verifyNotifySign(req.headers, rawBody)) {
        log.error({ elapsedMs: Date.now() - startTime }, 'refund notify signature FAILED');
        return res.status(200).json({ code: 'FAIL', message: 'Signature verification failed' });
      }

      // 先尝试商城退款（shopRefundService 内部按 SR 前缀路由）
      const shopRefundService = require('../services/shopRefundService');
      const shopResult = await shopRefundService.handleRefundNotify(rawBody);
      if (shopResult.success || shopResult.reason !== 'Not a shop refund') {
        const elapsed = Date.now() - startTime;
        if (shopResult.success) {
          log.info({ elapsedMs: elapsed, detail: shopResult.detail }, 'shop refund notify SUCCESS');
        } else {
          log.error({ elapsedMs: elapsed, reason: shopResult.reason }, 'shop refund notify FAILED');
        }
        return res.status(200).json({ code: 'SUCCESS', message: 'OK' });
      }

      // 非商城退款 → 走原有 pizza 订单退款
      const result = await refundService.handleRefundNotify(rawBody);
      const elapsed = Date.now() - startTime;

      if (result.success) {
        log.info({ elapsedMs: elapsed, detail: result.detail }, 'refund notify SUCCESS');
      } else {
        log.error({ elapsedMs: elapsed, reason: result.reason }, 'refund notify FAILED');
      }
      // Always return 200 to WeChat Pay
      res.status(200).json({ code: 'SUCCESS', message: 'OK' });
    } catch (err) {
      log.error({ err, elapsedMs: Date.now() - startTime }, 'refund notify exception');
      res.status(200).json({ code: 'SUCCESS', message: 'OK' });
    }
  },
};

module.exports = paymentController;
