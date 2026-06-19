const express = require('express');
const router = express.Router();
const config = require('../config');

router.get('/map', (req, res) => {
  res.json({ code: 0, data: { tencentKey: config.map.tencentKey || '' } });
});

router.get('/theme', (req, res) => {
  res.json({ code: 0, data: config.theme });
});

module.exports = router;
