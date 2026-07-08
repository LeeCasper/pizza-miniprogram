const express = require('express');
const router = express.Router();
const config = require('../config');
const defaultAvatarService = require('../services/defaultAvatarService');

// Shop status + custom notice (for miniprogram gate)
router.get('/shop', (req, res) => {
  res.json({
    code: 0,
    data: {
      enabled: config.business.shopEnabled !== false,
      notice: config.business.shopNotice || '',
    },
  });
});

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

router.get('/default-avatars', async (req, res) => {
  try {
    const list = await defaultAvatarService.list();
    res.json({ code: 0, data: list.map(a => a.url) });
  } catch (err) {
    res.status(500).json({ code: 500, message: '获取失败' });
  }
});

module.exports = router;
