const { Router } = require('express');
const controller = require('../controllers/pointsController');
const { auth } = require('../middleware/auth');
const { validate } = require('../middleware/validation');

const router = Router();

router.get('/products', auth, controller.products);
router.get('/products/:id', auth, controller.productDetail);
router.post('/redeem', auth, validate('redeemPoints'), controller.redeem);
router.get('/history', auth, controller.history);

module.exports = router;
