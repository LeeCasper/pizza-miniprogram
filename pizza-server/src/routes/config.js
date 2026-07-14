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

// Points mall categories
router.get('/points-categories', async (req, res) => {
  try {
    const svc = require('../services/pointsCategoryService');
    const list = await svc.findAll();
    res.json({ code: 0, data: list });
  } catch (err) {
    res.status(500).json({ code: 500, message: '获取失败' });
  }
});

router.get('/default-avatars', async (req, res) => {
  try {
    const list = await defaultAvatarService.list();
    res.json({ code: 0, data: list.map(a => a.url) });
  } catch (err) {
    res.status(500).json({ code: 500, message: '获取失败' });
  }
});

// Content pages (关于我们 / 用户协议 / 隐私政策)
router.get('/content/:key', async (req, res) => {
  try {
    const contentService = require('../services/contentService');
    const item = await contentService.get(req.params.key);
    if (!item) return res.status(404).json({ code: 404, message: '内容不存在' });
    res.json({ code: 0, data: item });
  } catch (err) {
    res.status(500).json({ code: 500, message: '获取失败' });
  }
});

module.exports = router;
