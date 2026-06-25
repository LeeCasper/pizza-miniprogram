// src/controllers/shopController.js — 会员商城公开接口
const shopProductService = require('../services/shopProductService');
const shopCategoryService = require('../services/shopCategoryService');
const shopFavoriteService = require('../services/shopFavoriteService');
const shopOrderService = require('../services/shopOrderService');
const shopPaymentService = require('../services/shopPaymentService');
const userService = require('../services/userService');
const { createLogger } = require('../utils/logger');
const log = createLogger('Shop');

const shopController = {
  async listCategories(req, res, next) {
    try {
      const data = await shopCategoryService.findAll();
      res.json({ code: 0, data });
    } catch (err) { next(err); }
  },

  async listProducts(req, res, next) {
    try {
      const category = req.query.category;
      const userId = req.user ? req.user.id : null;
      const data = await shopProductService.findAll(category, userId);
      res.json({ code: 0, data });
    } catch (err) { next(err); }
  },

  async productDetail(req, res, next) {
    try {
      const userId = req.user ? req.user.id : null;
      const data = await shopProductService.findById(req.params.id, userId);
      if (!data) return res.status(404).json({ code: 404, message: '商品不存在' });
      res.json({ code: 0, data });
    } catch (err) { next(err); }
  },

  async listFavorites(req, res, next) {
    try {
      const data = await shopFavoriteService.list(req.user.id);
      res.json({ code: 0, data });
    } catch (err) { next(err); }
  },

  async addFavorite(req, res, next) {
    try {
      const productId = req.params.productId;
      const exists = await shopFavoriteService.exists(productId);
      if (!exists) return res.status(404).json({ code: 404, message: '商品不存在' });
      await shopFavoriteService.add(req.user.id, productId);
      res.json({ code: 0, message: '收藏成功' });
    } catch (err) { next(err); }
  },

  async removeFavorite(req, res, next) {
    try {
      await shopFavoriteService.remove(req.user.id, req.params.productId);
      res.json({ code: 0, message: '已取消收藏' });
    } catch (err) { next(err); }
  },

  // ───── 订单 ─────

  async createOrder(req, res, next) {
    try {
      const { productId, quantity, recipientName, recipientPhone, recipientAddress, note, paymentMethod } = req.body;
      // 参数校验
      if (!productId || !quantity || quantity < 1) {
        return res.status(400).json({ code: 400, message: '请选择商品和数量' });
      }
      if (!recipientName || !recipientPhone || !recipientAddress) {
        return res.status(400).json({ code: 400, message: '请填写收货信息' });
      }
      if (!paymentMethod || !['wechat', 'balance'].includes(paymentMethod)) {
        return res.status(400).json({ code: 400, message: '请选择支付方式' });
      }

      const result = await shopOrderService.create({
        userId: req.user.id,
        productId: parseInt(productId),
        quantity: parseInt(quantity),
        recipientName,
        recipientPhone,
        recipientAddress,
        note: note || null,
        paymentMethod,
      });

      res.status(201).json({
        code: 0,
        data: { ...result.order, paymentStatus: result.paymentStatus },
      });
    } catch (err) {
      if (err.statusCode) return res.status(err.statusCode).json({ code: err.statusCode, message: err.message, codeField: err.code });
      next(err);
    }
  },

  async listMyOrders(req, res, next) {
    try {
      const { status, page = 1, limit = 20 } = req.query;
      const data = await shopOrderService.findByUser(req.user.id, status, parseInt(page), parseInt(limit));
      res.json({ code: 0, data });
    } catch (err) { next(err); }
  },

  async getOrder(req, res, next) {
    try {
      const order = await shopOrderService.findById(req.params.id);
      if (!order) return res.status(404).json({ code: 404, message: '订单不存在' });
      if (order.userId !== req.user.id) {
        return res.status(403).json({ code: 403, message: '无权查看该订单' });
      }
      res.json({ code: 0, data: order });
    } catch (err) { next(err); }
  },

  async cancelOrder(req, res, next) {
    try {
      const order = await shopOrderService.cancelByUser(req.params.id, req.user.id);
      res.json({ code: 0, data: order, message: '已取消' });
    } catch (err) {
      if (err.statusCode) return res.status(err.statusCode).json({ code: err.statusCode, message: err.message });
      next(err);
    }
  },

  // ───── 支付 ─────

  async createPayment(req, res, next) {
    try {
      const { orderId } = req.body;
      if (!orderId) {
        return res.status(400).json({ code: 400, message: '缺少订单号' });
      }

      // 获取用户 openid
      const user = await userService.findById(req.user.id);
      if (!user || !user.openid) {
        return res.status(400).json({ code: 400, message: '用户信息异常，请重新登录' });
      }

      const result = await shopPaymentService.createShopWechatPayment(
        req.user.id, orderId, user.openid
      );
      res.json({ code: 0, data: result });
    } catch (err) {
      if (err.statusCode) return res.status(err.statusCode).json({ code: err.statusCode, message: err.message });
      next(err);
    }
  },

  async paymentStatus(req, res, next) {
    try {
      const { orderId } = req.params;
      const order = await shopOrderService.findById(orderId);
      if (!order) return res.status(404).json({ code: 404, message: '订单不存在' });
      if (order.userId !== req.user.id) {
        return res.status(403).json({ code: 403, message: '无权查看' });
      }

      let status = await shopPaymentService.getShopOrderPaymentStatus(orderId);

      // 本地 pending 时主动查询微信
      if (status.status === 'pending' && status.outTradeNo) {
        try {
          const paymentService = require('../services/paymentService');
          const wxOrder = await paymentService.queryWechatOrder(status.outTradeNo);
          if (wxOrder && wxOrder.trade_state === 'SUCCESS') {
            const syncResult = await shopPaymentService.syncShopOrderFromWechat(
              orderId, status.outTradeNo, wxOrder.transaction_id
            );
            if (syncResult.synced) {
              status = await shopPaymentService.getShopOrderPaymentStatus(orderId);
            }
          }
        } catch (_) {
          // WeChat query may fail — return local status
        }
      }

      res.json({ code: 0, data: status });
    } catch (err) { next(err); }
  },

  async payWithBalance(req, res, next) {
    try {
      const { orderId } = req.body;
      if (!orderId) {
        return res.status(400).json({ code: 400, message: '缺少订单号' });
      }
      const result = await shopPaymentService.payShopOrderWithBalance(req.user.id, orderId);
      res.json({ code: 0, data: result, message: '支付成功' });
    } catch (err) {
      if (err.statusCode) return res.status(err.statusCode).json({ code: err.statusCode, message: err.message, codeField: err.code });
      next(err);
    }
  },

  // ───── 确认收货 ─────
  async confirmReceipt(req, res, next) {
    try {
      const order = await shopOrderService.confirmReceipt(req.params.id, req.user.id);
      res.json({ code: 0, data: order, message: '已确认收货' });
    } catch (err) {
      if (err.statusCode) return res.status(err.statusCode).json({ code: err.statusCode, message: err.message });
      next(err);
    }
  },

  // ───── 申请退款 ─────
  async requestRefund(req, res, next) {
    try {
      const order = await shopOrderService.findById(req.params.id);
      if (!order) return res.status(404).json({ code: 404, message: '订单不存在' });
      if (order.userId !== req.user.id) return res.status(403).json({ code: 403, message: '无权操作' });
      if (order.status !== 'paid') return res.status(400).json({ code: 400, message: '只能为已支付但未发货的订单申请退款' });
      if (order.refundStatus === 'processing' || order.refundStatus === 'success') {
        return res.status(400).json({ code: 400, message: '已申请退款，请勿重复操作' });
      }

      const shopRefundService = require('../services/shopRefundService');
      const result = await shopRefundService.refund(req.params.id, req.body.reason || '用户申请退款', req.user);
      res.json({ code: 0, data: result, message: result.message });
    } catch (err) {
      if (err.statusCode) return res.status(err.statusCode).json({ code: err.statusCode, message: err.message });
      next(err);
    }
  },
};

module.exports = shopController;
