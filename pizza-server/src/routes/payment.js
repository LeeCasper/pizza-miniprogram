/**
 * Payment Routes
 *
 * /api/v1/pay/order          — Create WeChat Pay for order
 * /api/v1/pay/recharge       — Create WeChat Pay for recharge
 * /api/v1/pay/notify         — WeChat Pay callback (no auth)
 * /api/v1/pay/refund-notify  — WeChat Pay refund callback (no auth)
 * /api/v1/pay/order/:id/status — Query order payment status
 * /api/v1/pay/recharge/:no/status — Query recharge payment status
 */

const express = require('express');
const router = express.Router();
const controller = require('../controllers/paymentController');
const { auth } = require('../middleware/auth');

// All payment endpoints require auth except callbacks (WeChat's callbacks)
router.post('/order', auth, controller.createOrderPayment);
router.post('/recharge', auth, controller.createRechargePayment);
router.post('/notify', controller.notify);
router.post('/refund-notify', controller.refundNotify);
router.get('/order/:orderId/status', auth, controller.orderPaymentStatus);
router.get('/recharge/:outTradeNo/status', auth, controller.rechargePaymentStatus);

module.exports = router;
