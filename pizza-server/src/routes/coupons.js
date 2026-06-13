const { Router } = require('express');
const controller = require('../controllers/couponController');
const { auth } = require('../middleware/auth');

const router = Router();

router.use(auth);

router.get('/', controller.list);
router.put('/:id/use', controller.use);

module.exports = router;
