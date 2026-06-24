// src/controllers/shopController.js — 会员商城公开接口
const shopProductService = require('../services/shopProductService');
const shopCategoryService = require('../services/shopCategoryService');
const shopFavoriteService = require('../services/shopFavoriteService');

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
};

module.exports = shopController;
