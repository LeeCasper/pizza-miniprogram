const cartService = require('../services/cartService');

const cartController = {
  async list(req, res, next) {
    try {
      const items = await cartService.findByUserId(req.user.id);
      const count = items.reduce((sum, i) => sum + i.quantity, 0);
      const total = items.reduce((sum, i) => sum + i.productPrice * i.quantity, 0);
      res.json({ code: 0, data: { items, count, total } });
    } catch (err) {
      next(err);
    }
  },

  async addItem(req, res, next) {
    try {
      const { productId, quantity, restrictions } = req.body;
      const result = await cartService.addItem(req.user.id, productId, quantity, restrictions);
      const count = result.reduce((sum, i) => sum + i.quantity, 0);
      const total = result.reduce((sum, i) => sum + i.productPrice * i.quantity, 0);
      res.json({ code: 0, data: { items: result, count, total }, message: '已加入购物车' });
    } catch (err) {
      next(err);
    }
  },

  async updateItem(req, res, next) {
    try {
      const { quantity, restrictions } = req.body;
      const result = await cartService.updateItem(req.user.id, req.params.productId, quantity, restrictions);
      const count = result.reduce((sum, i) => sum + i.quantity, 0);
      const total = result.reduce((sum, i) => sum + i.productPrice * i.quantity, 0);
      res.json({ code: 0, data: { items: result, count, total } });
    } catch (err) {
      next(err);
    }
  },

  async removeItem(req, res, next) {
    try {
      const result = await cartService.removeItem(req.user.id, req.params.productId);
      const count = result.reduce((sum, i) => sum + i.quantity, 0);
      const total = result.reduce((sum, i) => sum + i.productPrice * i.quantity, 0);
      res.json({ code: 0, data: { items: result, count, total } });
    } catch (err) {
      next(err);
    }
  },

  async clear(req, res, next) {
    try {
      await cartService.clear(req.user.id);
      res.json({ code: 0, data: { items: [], count: 0, total: 0 }, message: '购物车已清空' });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = cartController;
