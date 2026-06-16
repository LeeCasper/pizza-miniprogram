/**
 * Payment Routes
 *
 * /api/v1/pay/order          — Create WeChat Pay for order
 * /api/v1/pay/recharge       — Create WeChat Pay for recharge
 * /api/v1/pay/notify         — WeChat Pay callback (no auth)
 * /api/v1/pay/order/:id/status — Query order payment status
 */

const express = require('express');
const router = express.Router();
const controller = require('../controllers/paymentController');
const { auth } = require('../middleware/auth');

// All payment endpoints require auth except notify (WeChat's callback)
router.post('/order', auth, controller.createOrderPayment);
router.post('/recharge', auth, controller.createRechargePayment);
router.post('/notify', controller.notify);
router.get('/order/:orderId/status', auth, controller.orderPaymentStatus);

module.exports = router;
