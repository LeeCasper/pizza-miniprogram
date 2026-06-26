/**
 * Logistics Controller
 *
 * Handles user-facing logistics tracking requests.
 * All endpoints require JWT authentication.
 */

const logisticsService = require('../services/logisticsService');
const { createLogger } = require('../utils/logger');
const log = createLogger('Logistics');

const logisticsController = {
  /**
   * GET /api/v1/logistics/orders
   * List user's shipped orders with tracking summaries.
   */
  async listMyShippedOrders(req, res) {
    try {
      const { page = 1, limit = 20 } = req.query;
      const data = await logisticsService.getUserShippedOrders(
        req.user.id,
        parseInt(page, 10),
        parseInt(limit, 10)
      );
      res.json({ code: 0, data });
    } catch (err) {
      log.error({ err }, 'list shipped orders failed');
      res.status(500).json({ code: 500, message: '获取物流列表失败' });
    }
  },

  /**
   * GET /api/v1/logistics/track/:orderId
   * Get full tracking detail for a specific order.
   */
  async getTrackingDetail(req, res) {
    try {
      const data = await logisticsService.getOrderTracking(
        req.user.id,
        req.params.orderId
      );
      res.json({ code: 0, data });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({
          code: err.statusCode,
          message: err.message,
        });
      }
      log.error({ err }, 'get tracking detail failed');
      res.status(500).json({ code: 500, message: '获取物流详情失败' });
    }
  },
};

module.exports = logisticsController;
