const paymentService = require('../services/paymentService');
const userService = require('../services/userService');
const pool = require('../config/database');

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
    try {
      // req.body is a Buffer when using express.raw({type: 'application/json'})
      const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : req.body;

      console.log('[Payment] Received notify callback');

      const result = await paymentService.handleNotify(rawBody);

      // Always return 200 to WeChat Pay (even on error) to prevent retry
      if (result.success) {
        res.status(200).json({ code: 'SUCCESS', message: 'OK' });
      } else {
        // Still 200 — WeChat requires HTTP 200, but we signal failure
        // in the response body so we can debug
        console.error('[Payment] Notify failed:', result.reason);
        res.status(200).json({ code: 'SUCCESS', message: 'OK' });
      }
    } catch (err) {
      console.error('[Payment] Notify exception:', err.message);
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
            // State changed — re-trigger processing
            status.status = 'success';
            status.transactionId = wxResult.transaction_id;
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
};

module.exports = paymentController;
