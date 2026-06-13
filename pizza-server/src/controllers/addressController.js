const addressService = require('../services/addressService');

const addressController = {
  async list(req, res, next) {
    try {
      const addresses = await addressService.findByUser(req.user.id);
      res.json({ code: 0, data: addresses });
    } catch (err) {
      next(err);
    }
  },

  async detail(req, res, next) {
    try {
      const addr = await addressService.findById(req.params.id, req.user.id);
      if (!addr) {
        return res.status(404).json({ code: 404, message: '地址不存在' });
      }
      res.json({ code: 0, data: addr });
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const addr = await addressService.create(req.user.id, req.body);
      res.json({ code: 0, data: addr, message: '地址添加成功' });
    } catch (err) {
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const addr = await addressService.update(req.params.id, req.user.id, req.body);
      if (!addr) {
        return res.status(404).json({ code: 404, message: '地址不存在' });
      }
      res.json({ code: 0, data: addr, message: '地址修改成功' });
    } catch (err) {
      next(err);
    }
  },

  async delete(req, res, next) {
    try {
      const addr = await addressService.delete(req.params.id, req.user.id);
      if (!addr) {
        return res.status(404).json({ code: 404, message: '地址不存在' });
      }
      res.json({ code: 0, message: '地址已删除' });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = addressController;
