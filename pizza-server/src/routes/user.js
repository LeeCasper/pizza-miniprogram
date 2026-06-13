const { Router } = require('express');
const controller = require('../controllers/userController');
const { auth } = require('../middleware/auth');
const { validate } = require('../middleware/validation');

const router = Router();

router.get('/profile', auth, controller.getProfile);
router.put('/profile', auth, validate('updateProfile'), controller.updateProfile);
router.get('/settings', auth, controller.getSettings);
router.put('/settings', auth, validate('updateSettings'), controller.updateSettings);

module.exports = router;
