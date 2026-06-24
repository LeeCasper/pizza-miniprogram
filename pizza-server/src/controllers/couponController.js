const couponService = require('../services/couponService');
const couponClaimService = require('../services/couponClaimService');
const orderService = require('../services/orderService');

const couponController = {
  async list(req, res, next) {
    try {
      const { category, status } = req.query;
      const coupons = await couponService.findByUser(req.user.id, category, status);
      res.json({ code: 0, data: coupons });
    } catch (err) {
      next(err);
    }
  },

  async use(req, res, next) {
    try {
      const result = await couponService.use(req.params.id, req.user.id);
      if (result.error) {
        return res.status(400).json({ code: 400, message: result.error });
      }
      res.json({ code: 0, message: '已使用' });
    } catch (err) {
      next(err);
    }
  },

  // 使用兑换券 → 生成兑换商品订单（支付方式=coupon）
  async redeem(req, res, next) {
    try {
      const result = await orderService.createRedeemOrder(req.user.id, req.params.id);
      if (result.error) {
        return res.status(400).json({ code: 400, message: result.error });
      }
      res.json({ code: 0, message: '兑换成功', data: { orderId: result.orderId } });
    } catch (err) {
      next(err);
    }
  },

  async listClaimable(req, res, next) {
    try {
      const list = await couponClaimService.listClaimable(req.user.id);
      res.json({ code: 0, data: list });
    } catch (err) {
      next(err);
    }
  },

  async claim(req, res, next) {
    try {
      const result = await couponClaimService.claim(req.user.id, req.body.templateId);
      if (result.error) {
        return res.status(400).json({ code: 400, message: result.error, reason: result.reason });
      }
      res.json({ code: 0, message: '领取成功', data: { couponId: result.couponId } });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = couponController;
