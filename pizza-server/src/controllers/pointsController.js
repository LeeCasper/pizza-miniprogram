const pointsService = require('../services/pointsService');
const couponService = require('../services/couponService');
const userService = require('../services/userService');
const { computeTier, getTierLevel } = require('../utils/memberTier');
const pool = require('../config/database');

const pointsController = {
  async products(req, res, next) {
    try {
      const products = await pointsService.getProducts();
      res.json({ code: 0, data: products });
    } catch (err) {
      next(err);
    }
  },

  async productDetail(req, res, next) {
    try {
      const product = await pointsService.getProduct(req.params.id);
      if (!product) {
        return res.status(404).json({ code: 404, message: '商品不存在' });
      }
      res.json({ code: 0, data: product });
    } catch (err) {
      next(err);
    }
  },

  async redeem(req, res, next) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const userId = req.user.id;
      const { productId } = req.body;

      const pp = await pointsService.getProduct(productId);
      if (!pp) {
        await conn.rollback();
        return res.status(404).json({ code: 404, message: '商品不存在' });
      }
      if (pp.stock === 0) {
        await conn.rollback();
        return res.status(400).json({ code: 400, message: '商品已售罄' });
      }

      // Check user points
      const [userRows] = await conn.query('SELECT points FROM users WHERE id = ?', [userId]);
      const userPoints = userRows[0].points;
      if (userPoints < pp.points) {
        await conn.rollback();
        return res.status(400).json({ code: 400, message: '积分不足' });
      }

      // Deduct points
      const newPoints = userPoints - pp.points;
      const newTier = getTierLevel(newPoints);
      await conn.query('UPDATE users SET points = ?, member_level = ? WHERE id = ?',
        [newPoints, newTier, userId]);

      // Record history
      await conn.query(
        'INSERT INTO points_history (user_id, points_change, balance_after, reason, reference_id) VALUES (?, ?, ?, ?, ?)',
        [userId, -pp.points, newPoints, '积分兑换', String(productId)]
      );

      // Deduct stock if limited
      if (pp.stock > 0) {
        await conn.query('UPDATE points_products SET stock = stock - 1 WHERE id = ?', [productId]);
      }

      // Generate coupon
      let coupon = null;
      if (pp.redeemType === 'coupon') {
        const validFrom = new Date();
        const validTo = new Date();
        validTo.setDate(validTo.getDate() + pp.couponValidDays);

        const code = 'MK' +
          String(new Date().getFullYear()).slice(2) +
          String(new Date().getMonth() + 1).padStart(2, '0') +
          String(new Date().getDate()).padStart(2, '0') +
          String(productId).padStart(2, '0') +
          Math.random().toString(36).slice(2, 6).toUpperCase();

        coupon = await couponService.create({
          userId,
          name: pp.couponName || pp.name,
          desc: pp.desc,
          detailDesc: pp.detailDesc,
          category: pp.couponCategory,
          value: pp.couponValue,
          source: '积分商城兑换',
          code,
          discountType: pp.couponDiscountType,
          discountValue: pp.couponDiscountValue,
          minSpend: pp.couponMinSpend,
          redeemProductName: pp.redeemType === 'coupon' ? pp.name : '',
          redeemProductPrice: pp.points,
          redeemProductImage: pp.image,
          validFrom: validFrom.toISOString().split('T')[0],
          validTo: validTo.toISOString().split('T')[0],
          useTip: pp.useTip,
        });
      }

      await conn.commit();

      const tier = computeTier(newPoints);

      res.json({
        code: 0,
        data: {
          newPoints,
          coupon,
          tier,
        },
        message: '兑换成功！',
      });
    } catch (err) {
      await conn.rollback();
      next(err);
    } finally {
      conn.release();
    }
  },

  async history(req, res, next) {
    try {
      const { page = 1, limit = 20 } = req.query;
      const rows = await pointsService.getHistory(req.user.id, parseInt(page), parseInt(limit));
      res.json({ code: 0, data: rows });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = pointsController;
