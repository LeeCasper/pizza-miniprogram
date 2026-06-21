const express = require('express');
const router = express.Router();
const config = require('../config');

router.get('/map', (req, res) => {
  res.json({ code: 0, data: { tencentKey: config.map.tencentKey || '' } });
});

module.exports = router;
