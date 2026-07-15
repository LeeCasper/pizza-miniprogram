const { Router } = require('express');
const controller = require('../controllers/userController');
const { auth } = require('../middleware/auth');
const { validate } = require('../middleware/validation');

const router = Router();

// Public tier config
router.get('/member-tiers', controller.getMemberTiers);

router.get('/profile', auth, controller.getProfile);
router.put('/profile', auth, validate('updateProfile'), controller.updateProfile);
router.get('/settings', auth, controller.getSettings);
router.put('/settings', auth, validate('updateSettings'), controller.updateSettings);
router.get('/balance/history', auth, controller.getBalanceHistory);
router.post('/balance/recharge', auth, controller.recharge);
router.delete('/account', auth, controller.deleteAccount);
router.get('/notification-templates', auth, controller.getNotificationTemplates);

module.exports = router;
