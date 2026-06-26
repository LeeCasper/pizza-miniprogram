/**
 * Logistics Service
 *
 * Orchestrates between shop orders, carrier code mapping,
 * and the 快递100 tracking API. Exposes two user-facing
 * operations: list shipped orders with tracking summaries,
 * and fetch full tracking detail for a single order.
 */

const pool = require('../config/database');
const config = require('../config');
const shopOrderService = require('./shopOrderService');
const { queryTracking } = require('./kuaidi100Service');
const { getCarrierCode } = require('./carrierMap');
const { createLogger } = require('../utils/logger');
const log = createLogger('Logistics');

// ── Status labels ────────────────────────────────────

const STATE_MAP = {
  '0': '运输中',
  '1': '已揽收',
  '2': '疑难',
  '3': '已签收',
  '4': '退签',
  '5': '派件中',
  '6': '退回中',
  '7': '转单',
  '8': '清关中',
  '14': '到件',
};

const ORDER_STATUS_LABEL = {
  shipped: '已发货',
  completed: '已完成',
};

// ── Formatting helpers ───────────────────────────────

function formatOrderItem(row) {
  return {
    id: row.id,
    productName: row.product_name,
    productImage: row.product_image,
    price: parseFloat(row.price),
    quantity: row.quantity,
    subtotal: parseFloat(row.subtotal),
  };
}

function formatLogisticsOrder(row, items) {
  return {
    id: row.id,
    status: row.status,
    statusLabel: ORDER_STATUS_LABEL[row.status] || row.status,
    totalAmount: parseFloat(row.total_amount),
    paidAmount: parseFloat(row.paid_amount),
    shippingCompany: row.shipping_company,
    trackingNo: row.tracking_no,
    shippedAt: row.shipped_at,
    completedAt: row.completed_at,
    items: (items || []).map(formatOrderItem),
  };
}

function formatTrackingSummary(kuaidiResult) {
  // Check both possible success fields
  const isOk = kuaidiResult.status === '200' || kuaidiResult.returnCode === '200';
  if (!isOk) {
    return {
      error: true,
      message: kuaidiResult.message || '查询失败',
    };
  }
  const state = String(kuaidiResult.state);
  const latest = kuaidiResult.data && kuaidiResult.data[0];
  return {
    state,
    stateLabel: STATE_MAP[state] || '未知',
    isDelivered: state === '3',
    latestEvent: latest
      ? { time: latest.time, context: latest.context }
      : null,
  };
}

function formatTrackingFull(kuaidiResult) {
  const isOk = kuaidiResult.status === '200' || kuaidiResult.returnCode === '200';
  if (!isOk) {
    throw Object.assign(
      new Error(kuaidiResult.message || '查询物流信息失败'),
      { statusCode: 502 }
    );
  }
  return {
    state: String(kuaidiResult.state),
    stateLabel: STATE_MAP[String(kuaidiResult.state)] || '未知',
    isDelivered: String(kuaidiResult.state) === '3',
    carrier: kuaidiResult.com || '',
    trackingNo: kuaidiResult.nu || '',
    events: (kuaidiResult.data || []).map((e) => ({
      time: e.time,
      context: e.context,
      ftime: e.ftime,
      location: e.location || '',
    })),
  };
}

// ── Service ──────────────────────────────────────────

const logisticsService = {
  /**
   * Get user's shipped/completed orders with tracking summaries.
   * Uses cached tracking queries (5min TTL) for list performance.
   *
   * @param {number} userId
   * @param {number} [page=1]
   * @param {number} [limit=20]
   * @returns {Promise<{ list: Array, total: number }>}
   */
  async getUserShippedOrders(userId, page = 1, limit = 20) {
    const offset = (page - 1) * limit;

    // Count
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM shop_orders
       WHERE user_id = ? AND status IN ('shipped', 'completed')
       AND shipping_company IS NOT NULL AND shipping_company != ''
       AND tracking_no IS NOT NULL AND tracking_no != ''`,
      [userId]
    );

    // Fetch orders
    const [orders] = await pool.query(
      `SELECT * FROM shop_orders
       WHERE user_id = ? AND status IN ('shipped', 'completed')
       AND shipping_company IS NOT NULL AND shipping_company != ''
       AND tracking_no IS NOT NULL AND tracking_no != ''
       ORDER BY shipped_at DESC
       LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );

    // Batch-load order items
    const orderIds = orders.map((o) => o.id);
    let itemsMap = {};
    if (orderIds.length > 0) {
      const [allItems] = await pool.query(
        'SELECT * FROM shop_order_items WHERE order_id IN (?)',
        [orderIds]
      );
      for (const item of allItems) {
        if (!itemsMap[item.order_id]) itemsMap[item.order_id] = [];
        itemsMap[item.order_id].push(item);
      }
    }

    // Credentials
    const credentials = {
      customer: config.logistics?.customer || '',
      key: config.logistics?.key || '',
      enabled: config.logistics?.enabled,
    };

    // Build response — one tracking query per order
    const list = [];
    for (const order of orders) {
      const entry = formatLogisticsOrder(order, itemsMap[order.id] || []);

      const com = getCarrierCode(order.shipping_company);
      if (!com) {
        entry.tracking = {
          unsupported: true,
          message: `暂不支持查询 "${order.shipping_company}" 的物流信息`,
        };
      } else if (!credentials.enabled || !credentials.customer) {
        entry.tracking = {
          pending: true,
          message: '物流信息暂未接入，请手动查询',
        };
      } else {
        try {
          const tracking = await queryTracking(
            { com, num: order.tracking_no },
            credentials
          );
          entry.tracking = formatTrackingSummary(tracking);
        } catch (err) {
          log.warn({ err, orderId: order.id, com }, 'tracking query failed for order');
          entry.tracking = {
            error: true,
            message: err.message || '查询失败',
          };
        }
      }

      list.push(entry);
    }

    return { list, total: total || 0 };
  },

  /**
   * Get full tracking detail for a specific order (fresh query, no cache).
   * Validates that the order belongs to the requesting user.
   *
   * @param {number} userId
   * @param {string} orderId
   * @returns {Promise<object>} Full tracking detail with events array
   */
  async getOrderTracking(userId, orderId) {
    // Use shopOrderService for validation and formatting
    const order = await shopOrderService.findById(orderId);

    if (!order) {
      throw Object.assign(new Error('订单不存在'), { statusCode: 404 });
    }
    if (order.userId !== userId) {
      throw Object.assign(new Error('无权查看该订单'), { statusCode: 403 });
    }
    if (!order.shippingCompany || !order.trackingNo) {
      throw Object.assign(new Error('该订单暂无物流信息'), { statusCode: 404 });
    }

    const com = getCarrierCode(order.shippingCompany);
    if (!com) {
      throw Object.assign(
        new Error(`暂不支持查询 "${order.shippingCompany}" 的物流信息`),
        { statusCode: 400 }
      );
    }

    const credentials = {
      customer: config.logistics?.customer || '',
      key: config.logistics?.key || '',
      enabled: config.logistics?.enabled,
    };

    if (!credentials.enabled || !credentials.customer) {
      throw Object.assign(new Error('物流服务未配置'), { statusCode: 503 });
    }

    const tracking = await queryTracking(
      { com, num: order.trackingNo },
      credentials,
      true // skip cache for fresh detail
    );

    return {
      orderId: order.id,
      shippingCompany: order.shippingCompany,
      trackingNo: order.trackingNo,
      ...formatTrackingFull(tracking),
    };
  },
};

module.exports = logisticsService;
