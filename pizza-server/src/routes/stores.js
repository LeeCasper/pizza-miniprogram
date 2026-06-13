const { Router } = require('express');
const controller = require('../controllers/storeController');

const router = Router();

router.get('/', controller.list);
router.get('/:id', controller.detail);

module.exports = router;
