const { Router } = require('express');
const bannerService = require('../services/bannerService');

const router = Router();

/**
 * GET /api/v1/banners
 * Public: returns active banners (for mini program carousel)
 */
router.get('/', async (req, res) => {
  try {
    const banners = await bannerService.getActive();
    return res.json({ code: 0, data: banners });
  } catch (err) {
    console.error('[Banners] List error:', err);
    return res.status(500).json({ code: 500, message: '获取轮播图失败' });
  }
});

module.exports = router;
