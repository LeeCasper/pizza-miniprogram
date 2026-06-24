const { Router } = require('express');
const controller = require('../controllers/couponController');
const { auth } = require('../middleware/auth');
const { validate } = require('../middleware/validation');

const router = Router();

router.use(auth);

router.get('/claimable', controller.listClaimable);
router.post('/claim', validate('claimCoupon'), controller.claim);

router.get('/', controller.list);
router.put('/:id/use', controller.use);
router.post('/:id/redeem', controller.redeem);

module.exports = router;
