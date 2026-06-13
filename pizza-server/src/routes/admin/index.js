const { Router } = require('express');
const ctrl = require('../../controllers/adminController');
const upload = require('../upload');

const router = Router();

// Login
router.get('/login', ctrl.loginPage);
router.post('/api/login', ctrl.doLogin);
router.get('/logout', ctrl.logout);

// Protected routes
router.use(ctrl.authRequired);

// Dashboard
router.get('/dashboard', ctrl.dashboard);
router.get('/', (req, res) => res.redirect('/admin/dashboard'));

// Products
router.get('/products', ctrl.products);
router.get('/products/create', ctrl.newProductForm);
router.get('/products/:id/edit', ctrl.editProductForm);
router.post('/api/products', ctrl.createProduct);
router.post('/api/products/:id', ctrl.updateProduct);
router.post('/api/products/:id/delete', ctrl.deleteProduct);

// Orders
router.get('/orders', ctrl.orders);
router.get('/orders/:id', ctrl.orderDetail);
router.post('/api/orders/:id/status', ctrl.updateOrderStatus);

// Coupons
router.get('/coupons', ctrl.coupons);

// Users
router.get('/users', ctrl.users);

// Points Products
router.get('/points', ctrl.pointsProducts);
router.get('/points/create', ctrl.newPointsProductForm);
router.get('/points/:id/edit', ctrl.editPointsProductForm);
router.post('/api/points', ctrl.createPointsProduct);
router.post('/api/points/:id', ctrl.updatePointsProduct);
module.exports = router;
