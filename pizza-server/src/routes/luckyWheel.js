'use strict';

const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const ctrl = require('../controllers/luckyWheelController');

router.get('/config', auth, ctrl.config);
router.post('/draw', auth, validate('luckyDraw'), ctrl.draw);
router.get('/records', auth, ctrl.records);

module.exports = router;
