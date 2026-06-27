const { Router } = require('express');
const controller = require('../controllers/authController');
const { auth } = require('../middleware/auth');

const router = Router();

router.post('/login', controller.login);
router.post('/logout', auth, controller.logout);
router.post('/phone', auth, controller.bindPhone);

module.exports = router;
