const { Router } = require('express');
const controller = require('../controllers/productController');

const router = Router();

router.get('/', controller.list);
router.get('/categories', controller.categories);
router.get('/:id', controller.detail);

module.exports = router;
