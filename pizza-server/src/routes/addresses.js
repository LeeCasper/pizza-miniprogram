const { Router } = require('express');
const controller = require('../controllers/addressController');
const { auth } = require('../middleware/auth');
const { validate } = require('../middleware/validation');

const router = Router();

router.use(auth);

router.get('/', controller.list);
router.post('/', validate('createAddress'), controller.create);
router.get('/:id', controller.detail);
router.put('/:id', validate('updateAddress'), controller.update);
router.delete('/:id', controller.delete);

module.exports = router;
