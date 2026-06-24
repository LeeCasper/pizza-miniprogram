// src/routes/shop.js — 会员商城公开路由（挂载于 /api/v1/shop）
const express = require('express');
const router = express.Router();
const { auth, optionalAuth } = require('../middleware/auth');
const shopController = require('../controllers/shopController');

// 公开（带 optionalAuth 以便返回 isFavorited）
router.get('/categories', shopController.listCategories);
router.get('/products', optionalAuth, shopController.listProducts);
router.get('/products/:id', optionalAuth, shopController.productDetail);

// 需登录
router.get('/favorites', auth, shopController.listFavorites);
router.post('/favorites/:productId', auth, shopController.addFavorite);
router.delete('/favorites/:productId', auth, shopController.removeFavorite);

module.exports = router;
