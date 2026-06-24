// src/controllers/adminShopController.js — 会员商城管理接口（/api/v1/admin/shop/*）
const shopProductService = require('../services/shopProductService');
const shopCategoryService = require('../services/shopCategoryService');
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
};

module.exports = adminShopController;
