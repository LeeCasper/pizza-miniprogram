const { Router } = require('express');
const controller = require('../controllers/uploadController');
const { auth } = require('../middleware/auth');
const { upload } = require('../config/multer');

const router = Router();

router.post('/avatar', auth, upload.single('file'), controller.uploadAvatar);

module.exports = router;
