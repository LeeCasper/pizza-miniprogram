const { Router } = require('express');
const controller = require('../controllers/authController');
const { auth } = require('../middleware/auth');

const router = Router();

router.post('/login', controller.login);
router.post('/logout', auth, controller.logout);

module.exports = router;
