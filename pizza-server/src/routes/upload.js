const { Router } = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const controller = require('../controllers/uploadController');
const { auth } = require('../middleware/auth');
const config = require('../config');

const storage = multer.diskStorage({
  destination: config.upload.dir,
  filename(req, file, cb) {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, uuidv4() + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: config.upload.maxFileSize },
  fileFilter(req, file, cb) {
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('仅支持 JPG/PNG/GIF/WebP 图片'));
    }
  },
});

const router = Router();

router.post('/avatar', auth, upload.single('file'), controller.uploadAvatar);

module.exports = router;
