const orderService = require('../services/orderService');
const cartService = require('../services/cartService');
const couponService = require('../services/couponService');
const userService = require('../services/userService');
const pointsService = require('../services/pointsService');
const { generatePickupCode } = require('../utils/pickupCode');
const { computeTier, getTierLevel } = require('../utils/memberTier');
const pool = require('../config/database');

const orderController = {
  async list(req, res, next) {
    try {
      const { status, page = 1, limit = 10 } = req.query;
      const orders = await orderService.findByUser(req.user.id, status, parseInt(page), parseInt(limit));
      res.json({ code: 0, data: orders });
    } catch (err) {
      next(err);
    }
  },

  async detail(req, res, next) {
    try {
      const order = await orderService.findById(req.params.id);
      if (!order) {
        return res.status(404).json({ code: 404, message: '订单不存在' });
      }
      res.json({ code: 0, data: order });
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const userId = req.user.id;
      const { couponId, note } = req.body;

      // 1. Get cart items with current prices
      const cartItems = await cartService.getCartWithProducts(userId);
      if (cartItems.length === 0) {
        await conn.rollback();
        return res.status(400).json({ code: 400, message: '购物车为空' });
      }

      let total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
      let discountAmount = 0;
      let couponUsedId = null;

      // 2. Process coupon if provided
      if (couponId) {
        const [coupons] = await conn.query(
          'SELECT * FROM coupons WHERE id = ? AND user_id = ?', [couponId, userId]
        );
        const coupon = coupons[0];
        if (!coupon) {
          await conn.rollback();
          return res.status(400).json({ code: 400, message: '优惠券不存在' });
        }
        if (coupon.status !== 'available') {
          await conn.rollback();
          return res.status(400).json({ code: 400, message: '优惠券不可用' });
        }
        const validTo = new Date(coupon.valid_to);
        if (validTo < new Date()) {
          await conn.query("UPDATE coupons SET status = 'expired' WHERE id = ?", [couponId]);
          await conn.commit();
          return res.status(400).json({ code: 400, message: '优惠券已过期' });
        }

        // Calculate discount based on coupon type
        if (coupon.category === 'discount') {
          if (coupon.min_spend > 0 && total < parseFloat(coupon.min_spend)) {
            await conn.rollback();
            return res.status(400).json({ code: 400, message: `未满${coupon.min_spend}元，无法使用此券` });
          }
          switch (coupon.discount_type) {
            case 'buy_one_get_one': {
              const cheapest = cartItems.reduce((min, item) => item.price < min.price ? item : min, cartItems[0]);
              discountAmount = cheapest.price;
              break;
            }
            case 'half_price': {
              const target = cartItems.find(i => i.productId === coupon.product_id) || cartItems[0];
              discountAmount = target.price * 0.5 * target.quantity;
              break;
            }
            case 'fixed_amount':
              discountAmount = parseFloat(coupon.discount_value) || 0;
              break;
            case 'free_delivery':
              discountAmount = 0; // No delivery in current model
              break;
          }
        }

        // Mark coupon as used
        await conn.query("UPDATE coupons SET status = 'used', used_at = NOW() WHERE id = ?", [couponId]);
        couponUsedId = couponId;
      }

      const paidAmount = Math.max(0, total - discountAmount);

      // 3. Generate order ID
      const now = new Date();
      const datePrefix = now.getFullYear().toString() +
        String(now.getMonth() + 1).padStart(2, '0') +
        String(now.getDate()).padStart(2, '0');
      const maxSeq = await (async () => {
        const [rows] = await conn.query(
          "SELECT MAX(CAST(SUBSTRING(id, 9) AS UNSIGNED)) AS maxSeq FROM orders WHERE id LIKE ?",
          [`${datePrefix}%`]
        );
        return rows[0].maxSeq || 0;
      })();
      const orderId = datePrefix + String(maxSeq + 1).padStart(3, '0');

      // 4. Generate unique pickup code
      let pickupCode;
      do {
        pickupCode = generatePickupCode();
      } while (await (async () => {
        const [rows] = await conn.query(
          "SELECT id FROM orders WHERE pickup_code = ? AND DATE(created_at) = CURDATE()",
          [pickupCode]
        );
        return rows.length > 0;
      })());

      // 5. Insert order
      await conn.query(
        `INSERT INTO orders (id, user_id, status, total, discount_amount, paid_amount, pickup_code, store_name, coupon_used_id, note)
         VALUES (?, ?, 'waiting', ?, ?, ?, ?, '爱家店', ?, ?)`,
        [orderId, userId, total.toFixed(2), discountAmount.toFixed(2), paidAmount.toFixed(2),
         pickupCode, couponUsedId, note || '']
      );

      // 6. Insert order items
      for (const item of cartItems) {
        await conn.query(
          `INSERT INTO order_items (order_id, product_id, product_name, price, quantity, restrictions)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [orderId, item.productId, item.name, item.price, item.quantity,
           JSON.stringify(item.restrictions || [])]
        );
      }

      // 7. Clear cart
      await conn.query('DELETE FROM cart_items WHERE user_id = ?', [userId]);

      // 8. Add points
      const earnedPoints = Math.floor(paidAmount);
      const [userRows] = await conn.query('SELECT points FROM users WHERE id = ?', [userId]);
      const oldPoints = userRows[0].points;
      const newPoints = oldPoints + earnedPoints;
      const newTier = getTierLevel(newPoints);
      await conn.query('UPDATE users SET points = ?, member_level = ? WHERE id = ?',
        [newPoints, newTier, userId]);
      await conn.query(
        'INSERT INTO points_history (user_id, points_change, balance_after, reason, reference_id) VALUES (?, ?, ?, ?, ?)',
        [userId, earnedPoints, newPoints, '订单消费', orderId]
      );

      await conn.commit();

      // Build response
      const order = await orderService.findById(orderId);
      const tier = computeTier(newPoints);

      res.json({
        code: 0,
        data: {
          order,
          earnedPoints,
          newPoints,
          tier,
        },
        message: `订单已提交！获得${earnedPoints}积分`,
      });
    } catch (err) {
      await conn.rollback();
      next(err);
    } finally {
      conn.release();
    }
  },

  async cancel(req, res, next) {
    try {
      const order = await orderService.cancel(req.params.id, req.user.id);
      if (!order) {
        return res.status(400).json({ code: 400, message: '订单不存在或无法取消' });
      }
      res.json({ code: 0, data: order, message: '订单已取消' });
    } catch (err) {
      next(err);
    }
  },

  async pickupCode(req, res, next) {
    try {
      const order = await orderService.findById(req.params.id);
      if (!order || order.userId !== req.user.id) {
        return res.status(404).json({ code: 404, message: '订单不存在' });
      }
      res.json({ code: 0, data: { pickupCode: order.pickupCode } });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = orderController;
