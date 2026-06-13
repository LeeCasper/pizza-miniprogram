const storeService = require('../services/storeService');

const storeController = {
  async list(req, res, next) {
    try {
      const stores = await storeService.findAll();
      res.json({ code: 0, data: stores });
    } catch (err) {
      next(err);
    }
  },

  async detail(req, res, next) {
    try {
      const store = await storeService.findById(req.params.id);
      if (!store) {
        return res.status(404).json({ code: 404, message: '门店不存在' });
      }
      res.json({ code: 0, data: store });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = storeController;
