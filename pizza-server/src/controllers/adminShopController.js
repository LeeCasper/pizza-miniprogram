// src/controllers/adminShopController.js — 会员商城管理接口（/api/v1/admin/shop/*）
const shopProductService = require('../services/shopProductService');
const shopCategoryService = require('../services/shopCategoryService');
const shopOrderService = require('../services/shopOrderService');
const { autoDetectCarrier } = require('../services/kuaidi100Service');
const { createLogger } = require('../utils/logger');
const log = createLogger('AdminShop');

const adminShopController = {
  // ───── 商品 ─────
  async listProducts(req, res) {
    try {
      const data = await shopProductService.adminList();
      res.json({ code: 0, data });
    } catch (err) {
      log.error({ err }, 'admin list shop products failed');
      res.status(500).json({ code: 500, message: '获取商城商品失败' });
    }
  },

  async getProduct(req, res) {
    try {
      const data = await shopProductService.adminFindById(req.params.id);
      if (!data) return res.status(404).json({ code: 404, message: '商品不存在' });
      res.json({ code: 0, data });
    } catch (err) {
      log.error({ err }, 'admin get shop product failed');
      res.status(500).json({ code: 500, message: '获取商城商品失败' });
    }
  },

  async createProduct(req, res) {
    try {
      const b = req.body;
      const data = await shopProductService.create({
        shop_category_key: b.shop_category_key || null,
        name: b.name,
        subtitle: b.subtitle || null,
        price: parseFloat(b.price),
        original_price: (b.original_price !== undefined && b.original_price !== null && b.original_price !== '')
          ? parseFloat(b.original_price) : null,
        main_image: b.main_image || null,
        images: Array.isArray(b.images) ? b.images : [],
        detail_images: Array.isArray(b.detail_images) ? b.detail_images : [],
        detail_desc: b.detail_desc || null,
        stock: b.stock !== undefined ? parseInt(b.stock) : 0,
        tag: b.tag || null,
        is_available: b.is_available !== undefined ? (b.is_available ? 1 : 0) : 1,
        sort_order: b.sort_order !== undefined ? parseInt(b.sort_order) : 0,
      });
      res.status(201).json({ code: 0, data });
    } catch (err) {
      log.error({ err }, 'admin create shop product failed');
      res.status(500).json({ code: 500, message: '创建商城商品失败' });
    }
  },

  async updateProduct(req, res) {
    try {
      const b = req.body;
      const updateData = {};
      if (b.shop_category_key !== undefined) updateData.shop_category_key = b.shop_category_key || null;
      if (b.name !== undefined) updateData.name = b.name;
      if (b.subtitle !== undefined) updateData.subtitle = b.subtitle || null;
      if (b.price !== undefined) updateData.price = parseFloat(b.price);
      if (b.original_price !== undefined) {
        updateData.original_price = (b.original_price === null || b.original_price === '') ? null : parseFloat(b.original_price);
      }
      if (b.main_image !== undefined) updateData.main_image = b.main_image || null;
      if (b.images !== undefined) updateData.images = Array.isArray(b.images) ? b.images : [];
      if (b.detail_images !== undefined) updateData.detail_images = Array.isArray(b.detail_images) ? b.detail_images : [];
      if (b.detail_desc !== undefined) updateData.detail_desc = b.detail_desc || null;
      if (b.stock !== undefined) updateData.stock = parseInt(b.stock);
      if (b.tag !== undefined) updateData.tag = b.tag || null;
      if (b.is_available !== undefined) updateData.is_available = b.is_available ? 1 : 0;
      if (b.sort_order !== undefined) updateData.sort_order = parseInt(b.sort_order);
      const data = await shopProductService.update(req.params.id, updateData);
      if (!data) return res.status(404).json({ code: 404, message: '商品不存在' });
      res.json({ code: 0, data });
    } catch (err) {
      log.error({ err }, 'admin update shop product failed');
      res.status(500).json({ code: 500, message: '更新商城商品失败' });
    }
  },

  async deleteProduct(req, res) {
    try {
      await shopProductService.softDelete(req.params.id);
      res.json({ code: 0, message: '删除成功' });
    } catch (err) {
      log.error({ err }, 'admin delete shop product failed');
      res.status(500).json({ code: 500, message: '删除商城商品失败' });
    }
  },

  async toggleProduct(req, res) {
    try {
      const data = await shopProductService.toggle(req.params.id);
      res.json({ code: 0, data });
    } catch (err) {
      log.error({ err }, 'admin toggle shop product failed');
      res.status(500).json({ code: 500, message: '切换上下架失败' });
    }
  },

  // ───── 分类 ─────
  async listCategories(req, res) {
    try {
      const data = await shopCategoryService.adminList();
      res.json({ code: 0, data });
    } catch (err) {
      log.error({ err }, 'admin list shop categories failed');
      res.status(500).json({ code: 500, message: '获取商城分类失败' });
    }
  },

  async createCategory(req, res) {
    try {
      const { key, name, icon, sortOrder, isActive } = req.body;
      if (!key || !/^[a-z0-9_]+$/.test(key)) {
        return res.status(400).json({ code: 400, message: '分类标识只能包含小写字母、数字和下划线' });
      }
      if (!name || !name.trim()) {
        return res.status(400).json({ code: 400, message: '分类名称不能为空' });
      }
      const existing = await shopCategoryService.findByKey(key);
      if (existing) {
        return res.status(400).json({ code: 400, message: '该分类标识已存在' });
      }
      const data = await shopCategoryService.create({ key, name, icon, sortOrder, isActive });
      res.status(201).json({ code: 0, data });
    } catch (err) {
      log.error({ err }, 'admin create shop category failed');
      res.status(500).json({ code: 500, message: '创建商城分类失败' });
    }
  },

  async updateCategory(req, res) {
    try {
      const data = await shopCategoryService.update(req.params.key, req.body);
      if (!data) return res.status(404).json({ code: 404, message: '分类不存在' });
      res.json({ code: 0, data });
    } catch (err) {
      log.error({ err }, 'admin update shop category failed');
      res.status(500).json({ code: 500, message: '更新商城分类失败' });
    }
  },

  async deleteCategory(req, res) {
    try {
      const count = await shopCategoryService.countProducts(req.params.key);
      if (count > 0) {
        return res.status(400).json({ code: 400, message: `该分类下还有 ${count} 个商品,无法删除` });
      }
      await shopCategoryService.remove(req.params.key);
      res.json({ code: 0, message: '删除成功' });
    } catch (err) {
      if (err.errno === 1451 || err.code === 'ER_ROW_IS_REFERENCED_2') {
        return res.status(400).json({ code: 400, message: '该分类仍被商品引用,无法删除' });
      }
      log.error({ err }, 'admin delete shop category failed');
      res.status(500).json({ code: 500, message: '删除商城分类失败' });
    }
  },

  // ───── 订单 ─────

  async listOrders(req, res) {
    try {
      const { status, paymentMethod, page = 1, limit = 20 } = req.query;
      const data = await shopOrderService.adminList({
        status, paymentMethod,
        page: parseInt(page), limit: parseInt(limit),
      });
      res.json({ code: 0, data });
    } catch (err) {
      log.error({ err }, 'admin list shop orders failed');
      res.status(500).json({ code: 500, message: '获取商城订单失败' });
    }
  },

  async getOrder(req, res) {
    try {
      const data = await shopOrderService.findById(req.params.id);
      if (!data) return res.status(404).json({ code: 404, message: '订单不存在' });
      res.json({ code: 0, data });
    } catch (err) {
      log.error({ err }, 'admin get shop order failed');
      res.status(500).json({ code: 500, message: '获取商城订单失败' });
    }
  },

  async updateOrderStatus(req, res) {
    try {
      const { status } = req.body;
      if (!status) {
        return res.status(400).json({ code: 400, message: '请提供目标状态' });
      }

      // 取消已支付订单 → 先改状态，再退款（退款失败不阻塞）)
      let refund = null;
      if (status === 'cancelled') {
        const existing = await shopOrderService.findById(req.params.id);
        if (existing && existing.paymentMethod) {
          // 先更新状态
          let order;
          try {
            order = await shopOrderService.adminUpdateStatus(req.params.id, status, req.user);
          } catch (err) {
            if (err.code === 'INVALID_TRANSITION') {
              return res.status(400).json({ code: 400, message: err.message });
            }
            throw err;
          }
          // 再退款（独立 try/catch）
          try {
            const shopRefundService = require('../services/shopRefundService');
            refund = await shopRefundService.refund(
              req.params.id,
              req.body.reason || '管理员取消订单',
              req.user
            );
          } catch (refundErr) {
            log.error({ err: refundErr }, 'admin shop refund failed');
            refund = { success: false, message: refundErr.message };
          }
          return res.json({
            code: 0,
            message: '订单已取消' + (refund?.success ? '，退款已处理' : ''),
            data: order,
            refund,
          });
        }
      }

      // 普通状态变更（无需退款）
      const data = await shopOrderService.adminUpdateStatus(req.params.id, status, req.user);
      res.json({ code: 0, data, message: '状态已更新' });
    } catch (err) {
      if (err.code === 'INVALID_TRANSITION') {
        return res.status(400).json({ code: 400, message: err.message });
      }
      log.error({ err }, 'admin update shop order status failed');
      res.status(500).json({ code: 500, message: '更新商城订单状态失败' });
    }
  },

  async refundOrder(req, res) {
    try {
      const { reason } = req.body;
      const shopRefundService = require('../services/shopRefundService');
      const result = await shopRefundService.refund(req.params.id, reason || '管理员退款', req.user);
      res.json({ code: 0, data: result, message: '退款已处理' });
    } catch (err) {
      if (err.statusCode) return res.status(err.statusCode).json({ code: err.statusCode, message: err.message });
      log.error({ err }, 'admin shop refund failed');
      res.status(500).json({ code: 500, message: '退款处理失败' });
    }
  },

  async updateShipping(req, res) {
    try {
      const { shippingCompany, trackingNo } = req.body;
      if (!shippingCompany || !trackingNo) {
        return res.status(400).json({ code: 400, message: '请填写物流公司和运单号' });
      }
      const data = await shopOrderService.adminUpdateShipping(req.params.id, {
        shippingCompany, trackingNo,
      });
      res.json({ code: 0, data });
    } catch (err) {
      if (err.statusCode) return res.status(err.statusCode).json({ code: err.statusCode, message: err.message });
      log.error({ err }, 'admin update shop order shipping failed');
      res.status(500).json({ code: 500, message: '更新物流信息失败' });
    }
  },

  async autoDetectCarrier(req, res) {
    try {
      const { trackingNo } = req.body;
      if (!trackingNo || !trackingNo.trim()) {
        return res.status(400).json({ code: 400, message: '请提供运单号' });
      }
      const data = await autoDetectCarrier(trackingNo.trim());
      res.json({ code: 0, data });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ code: err.statusCode, message: err.message });
      }
      log.error({ err }, 'admin auto-detect carrier failed');
      res.status(500).json({ code: 500, message: '识别物流公司失败' });
    }
  },
};

module.exports = adminShopController;
