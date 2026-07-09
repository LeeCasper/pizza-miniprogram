const { Router } = require('express');
const controller = require('../controllers/orderController');
const { auth } = require('../middleware/auth');
const { validate } = require('../middleware/validation');

const router = Router();

router.use(auth);

router.get('/', controller.list);
router.post('/', validate('createOrder'), controller.create);
router.get('/:id', controller.detail);
router.put('/:id/cancel', controller.cancel);
router.put('/:id/complete', controller.complete);
router.get('/:id/pickup-code', controller.pickupCode);

module.exports = router;
