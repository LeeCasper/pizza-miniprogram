const path = require('path');
const fs = require('fs');
const userService = require('../services/userService');
const config = require('../config');

const uploadController = {
  // ── User avatar upload ──────────────────────────────────
  async uploadAvatar(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({ code: 400, message: '请选择图片' });
      }

      const relativePath = '/uploads/' + req.file.filename;
      // Store relative path — frontend prepends domain via fixImageUrl
      await userService.updateAvatar(req.user.id, relativePath);

      res.json({ code: 0, data: { url: relativePath }, message: '头像更新成功' });
    } catch (err) {
      next(err);
    }
  },

  // ── Admin: upload image ─────────────────────────────────
  async uploadImage(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({ code: 400, message: '请选择图片' });
      }

      const relativePath = '/uploads/' + req.file.filename;
      const url = relativePath; // relative path — frontend prepends base URL as needed

      res.json({
        code: 0,
        data: {
          url,
          filename: req.file.filename,
          size: req.file.size,
          originalName: req.file.originalname,
        },
        message: '上传成功',
      });
    } catch (err) {
      next(err);
    }
  },

  // ── Admin: list uploaded files ──────────────────────────
  async listFiles(req, res, next) {
    try {
      const dir = config.upload.dir;
      const { page = 1, limit = 20 } = req.query;
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));

      // Read directory
      let files = [];
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        files = entries
          .filter(e => e.isFile() && !e.name.startsWith('.'))
          .map(e => {
            const filePath = path.join(dir, e.name);
            const stat = fs.statSync(filePath);
            return {
              name: e.name,
              url: '/uploads/' + e.name,
              size: stat.size,
              lastModified: stat.mtime.toISOString(),
            };
          })
          .sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());
      } catch (err) {
        if (err.code === 'ENOENT') {
          files = [];
        } else {
          throw err;
        }
      }

      const total = files.length;
      const start = (pageNum - 1) * limitNum;
      const items = files.slice(start, start + limitNum);

      res.json({
        code: 0,
        data: {
          items,
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (err) {
      next(err);
    }
  },

  // ── Admin: delete a file ────────────────────────────────
  async deleteFile(req, res, next) {
    try {
      const { filename } = req.params;

      // Prevent directory traversal
      if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return res.status(400).json({ code: 400, message: '无效的文件名' });
      }

      const filePath = path.join(config.upload.dir, filename);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ code: 404, message: '文件不存在' });
      }

      fs.unlinkSync(filePath);

      res.json({ code: 0, message: '删除成功' });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = uploadController;
