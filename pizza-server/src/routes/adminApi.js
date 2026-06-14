const { Router } = require('express');
const ctrl = require('../controllers/adminApiController');
const { auth } = require('../middleware/auth');
const { adminOnly } = require('../middleware/roleGuard');

const router = Router();

// ── Public ────────────────────────────────────────────
router.post('/login', ctrl.login);

// ── Protected (JWT + admin role) ──────────────────────
router.use(auth, adminOnly);

// Profile
router.get('/profile', ctrl.getProfile);

// Dashboard
router.get('/dashboard/stats', ctrl.getDashboardStats);

// Products
router.get('/products', ctrl.listProducts);
router.get('/products/:id', ctrl.getProduct);
router.post('/products', ctrl.createProduct);
router.put('/products/:id', ctrl.updateProduct);
router.delete('/products/:id', ctrl.deleteProduct);

// Orders
router.get('/orders', ctrl.listOrders);
router.get('/orders/:id', ctrl.getOrder);
router.put('/orders/:id/status', ctrl.updateOrderStatus);

// Coupons
router.get('/coupons', ctrl.listCoupons);

// Users
router.get('/users', ctrl.listUsers);

// Points products
router.get('/points/products', ctrl.listPointsProducts);
router.get('/points/products/:id', ctrl.getPointsProduct);
router.post('/points/products', ctrl.createPointsProduct);
router.put('/points/products/:id', ctrl.updatePointsProduct);

module.exports = router;
