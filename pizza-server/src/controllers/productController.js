const productService = require('../services/productService');
const categoryService = require('../services/categoryService');

const productController = {
  async list(req, res, next) {
    try {
      const { category } = req.query;
      const products = await productService.findAll(category);
      res.json({ code: 0, data: products });
    } catch (err) {
      next(err);
    }
  },

  async detail(req, res, next) {
    try {
      const product = await productService.findById(req.params.id);
      if (!product) {
        return res.status(404).json({ code: 404, message: '商品不存在' });
      }
      res.json({ code: 0, data: product });
    } catch (err) {
      next(err);
    }
  },

  async categories(req, res, next) {
    try {
      const cats = await categoryService.findAll();
      res.json({ code: 0, data: cats });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = productController;
