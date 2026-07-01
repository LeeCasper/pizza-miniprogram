const path = require('path');
const fs = require('fs');
const userService = require('../services/userService');
const defaultAvatarService = require('../services/defaultAvatarService');
const config = require('../config');

// Parse image dimensions from file buffer (PNG / JPEG only)
function getImageDimensions(buf) {
  if (!buf || buf.length < 24) return null;
  try {
    // PNG: first 8 bytes are signature, then IHDR chunk at offset 8-24
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) {
      return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    }
    // JPEG: scan for SOF0/SOF2 marker (0xFF 0xC0 or 0xFF 0xC2)
    if (buf[0] === 0xFF && buf[1] === 0xD8) {
      let i = 2;
      while (i < buf.length - 9) {
        if (buf[i] !== 0xFF) { i++; continue; }
        const marker = buf[i + 1];
        if (marker === 0xC0 || marker === 0xC2) {
          return { width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5) };
        }
        i += 2 + buf.readUInt16BE(i + 2);
      }
    }
  } catch (_) { /* ignore parse errors */ }
  return null;
}

const uploadController = {
  // ── User avatar upload ──────────────────────────────────
  async uploadAvatar(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({ code: 400, message: '请选择图片' });
      }

      let url = '/uploads/' + req.file.filename;

      // If COS is enabled, push to COS
      if (config.storage.storageType === 'cos') {
        const cosService = require('../services/cosService');
        if (cosService.isConfigured()) {
          try {
            const localPath = path.join(config.upload.dir, req.file.filename);
            url = await cosService.uploadFile(localPath, req.file.filename);
            try { fs.unlinkSync(localPath); } catch (_) { /* ignore */ }
          } catch (err) {
            console.error('[uploadAvatar] COS upload failed, keeping local file:', err.message);
          }
        }
      }

      await userService.updateAvatar(req.user.id, url);

      res.json({ code: 0, data: { url }, message: '头像更新成功' });
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

      // Read image dimensions from file header
      let dims = null;
      try {
        const fd = fs.openSync(path.join(config.upload.dir, req.file.filename), 'r');
        const header = Buffer.alloc(65536);
        fs.readSync(fd, header, 0, 65536, 0);
        fs.closeSync(fd);
        dims = getImageDimensions(header);
      } catch (_) { /* ignore */ }
      if (dims) {
        const maxDim = 4096;
        if (dims.width > maxDim || dims.height > maxDim) {
          // Clean up oversized image
          try { fs.unlinkSync(path.join(config.upload.dir, req.file.filename)); } catch (_) {}
          return res.status(400).json({
            code: 400,
            message: `图片尺寸过大（${dims.width}×${dims.height}），单边最大 ${maxDim}px`,
          });
        }
      }

      let url = '/uploads/' + req.file.filename;

      // If COS is enabled and configured, push to COS and delete local temp
      if (config.storage.storageType === 'cos') {
        const cosService = require('../services/cosService');
        if (cosService.isConfigured()) {
          try {
            const localPath = path.join(config.upload.dir, req.file.filename);
            url = await cosService.uploadFile(localPath, req.file.filename);
            try { fs.unlinkSync(localPath); } catch (_) { /* ignore cleanup errors */ }
          } catch (err) {
            // COS failed — keep local file as fallback
            console.error('[uploadImage] COS upload failed, keeping local file:', err.message);
          }
        } else {
          console.warn('[uploadImage] COS enabled but not configured — keeping local file');
        }
      }

      res.json({
        code: 0,
        data: {
          url,
          filename: req.file.filename,
          size: req.file.size,
          originalName: req.file.originalname,
          ...(dims ? { width: dims.width, height: dims.height } : {}),
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

  // ── Admin: upload default avatar ───────────────────────
  async uploadDefaultAvatar(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({ code: 400, message: '请选择图片' });
      }

      const count = await defaultAvatarService.count();
      if (count >= 10) {
        // Clean up the uploaded file
        try { fs.unlinkSync(path.join(config.upload.dir, req.file.filename)); } catch (_) {}
        return res.status(400).json({ code: 400, message: '默认头像最多10个，请先删除旧的再添加' });
      }

      let url = '/uploads/' + req.file.filename;

      // If COS is enabled, push to COS
      if (config.storage.storageType === 'cos') {
        const cosService = require('../services/cosService');
        if (cosService.isConfigured()) {
          try {
            const localPath = path.join(config.upload.dir, req.file.filename);
            url = await cosService.uploadFile(localPath, req.file.filename);
            try { fs.unlinkSync(localPath); } catch (_) { /* ignore */ }
          } catch (err) {
            console.error('[uploadDefaultAvatar] COS upload failed, keeping local file:', err.message);
          }
        }
      }

      const result = await defaultAvatarService.create(url);

      res.json({ code: 0, data: result, message: '已添加' });
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

      // Check for optional COS URL in request body (full URL stored in DB)
      const fileUrl = req.body && req.body.url;

      if (fileUrl && fileUrl.startsWith('https://')) {
        // Delete from COS
        const cosService = require('../services/cosService');
        await cosService.deleteFile(fileUrl);
        return res.json({ code: 0, message: '删除成功' });
      }

      // Local file delete
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
