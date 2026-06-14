const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const config = require('./index');

/**
 * Shared multer configuration — used by both user avatar and admin upload routes.
 */
function createMulter(options = {}) {
  const storage = multer.diskStorage({
    destination: config.upload.dir,
    filename(req, file, cb) {
      const ext = path.extname(file.originalname) || '.jpg';
      const prefix = options.prefix || '';
      cb(null, prefix + uuidv4() + ext);
    },
  });

  return multer({
    storage,
    limits: { fileSize: options.maxSize || config.upload.maxFileSize },
    fileFilter(req, file, cb) {
      const allowed = options.allowedExts || ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
      const ext = path.extname(file.originalname).toLowerCase();
      if (allowed.includes(ext)) {
        cb(null, true);
      } else {
        cb(new Error('仅支持 JPG/PNG/GIF/WebP 图片'));
      }
    },
  });
}

// Default upload instance (used by user avatar)
const upload = createMulter();

// Admin upload instance (can be configured differently if needed)
const adminUpload = createMulter();

module.exports = { createMulter, upload, adminUpload };
