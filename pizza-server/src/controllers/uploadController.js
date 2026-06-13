const path = require('path');
const fs = require('fs');
const userService = require('../services/userService');
const config = require('../config');

const uploadController = {
  async uploadAvatar(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({ code: 400, message: '请选择图片' });
      }

      const relativePath = '/uploads/' + req.file.filename;
      const fullUrl = `${req.protocol}://${req.get('host')}${relativePath}`;
      await userService.updateAvatar(req.user.id, fullUrl);

      res.json({ code: 0, data: { url: fullUrl }, message: '头像更新成功' });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = uploadController;
