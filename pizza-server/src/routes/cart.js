const { Router } = require('express');
const controller = require('../controllers/cartController');
const { auth } = require('../middleware/auth');
const { validate } = require('../middleware/validation');

const router = Router();

router.use(auth);

router.get('/', controller.list);
router.post('/items', validate('addCartItem'), controller.addItem);
router.put('/items/:productId', validate('updateCartItem'), controller.updateItem);
router.delete('/items/:productId', controller.removeItem);
router.delete('/', controller.clear);

module.exports = router;
