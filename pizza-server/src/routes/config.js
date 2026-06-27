const express = require('express');
const router = express.Router();
const config = require('../config');

router.get('/map', (req, res) => {
  res.json({ code: 0, data: { tencentKey: config.map.tencentKey || '' } });
});

router.get('/beian', (req, res) => {
  res.json({
    code: 0,
    data: {
      icpBeian: config.business.icpBeian || '',
      gonganBeian: config.business.gonganBeian || '',
    },
  });
});

module.exports = router;
