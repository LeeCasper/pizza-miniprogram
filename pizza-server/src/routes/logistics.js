const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const logisticsController = require('../controllers/logisticsController');

// All logistics endpoints require JWT authentication
router.get('/orders', auth, logisticsController.listMyShippedOrders);
router.get('/track/:orderId', auth, logisticsController.getTrackingDetail);

module.exports = router;
