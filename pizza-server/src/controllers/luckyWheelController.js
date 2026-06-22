'use strict';

const luckyWheelService = require('../services/luckyWheelService');

module.exports = {
  async config(req, res, next) {
    try {
      const data = await luckyWheelService.getWheelConfig(req.user.id);
      res.json({ code: 0, data });
    } catch (err) { next(err); }
  },

  async draw(req, res, next) {
    try {
      const result = await luckyWheelService.draw(req.user.id, req.body.source);
      if (result && result.error) {
        return res.status(400).json({ code: 400, message: result.error, reason: result.reason });
      }
      res.json({ code: 0, data: result });
    } catch (err) { next(err); }
  },

  async records(req, res, next) {
    try {
      const { page, limit } = req.query;
      const data = await luckyWheelService.myRecords(req.user.id, page, limit);
      res.json({ code: 0, data });
    } catch (err) { next(err); }
  },
};
