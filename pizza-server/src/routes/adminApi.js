const { Router } = require('express');
const ctrl = require('../controllers/adminApiController');
const uploadCtrl = require('../controllers/uploadController');
const { auth } = require('../middleware/auth');
const { adminOnly } = require('../middleware/roleGuard');
const { adminUpload } = require('../config/multer');

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
router.put('/products/:id/toggle', ctrl.toggleProduct);

// Orders
router.get('/orders', ctrl.listOrders);
router.get('/orders/:id', ctrl.getOrder);
router.put('/orders/:id/status', ctrl.updateOrderStatus);

// Coupons
router.get('/coupons', ctrl.listCoupons);

// Coupon templates
router.get('/coupon-templates', ctrl.listCouponTemplates);
router.get('/coupon-templates/:id', ctrl.getCouponTemplate);
router.post('/coupon-templates', ctrl.createCouponTemplate);
router.put('/coupon-templates/:id', ctrl.updateCouponTemplate);
router.delete('/coupon-templates/:id', ctrl.deleteCouponTemplate);
router.put('/coupon-templates/:id/toggle', ctrl.toggleCouponTemplate);
router.post('/coupons/assign', ctrl.assignCoupon);

// Member tiers
router.get('/member-tiers', ctrl.listMemberTiers);
router.get('/member-tiers/:id', ctrl.getMemberTier);
router.post('/member-tiers', ctrl.createMemberTier);
router.put('/member-tiers/:id', ctrl.updateMemberTier);
router.delete('/member-tiers/:id', ctrl.deleteMemberTier);
router.put('/member-tiers/:id/toggle', ctrl.toggleMemberTier);

// Users
router.get('/users', ctrl.listUsers);
router.put('/users/:id', ctrl.updateUser);

// Points products
router.get('/points/products', ctrl.listPointsProducts);
router.get('/points/products/:id', ctrl.getPointsProduct);
router.post('/points/products', ctrl.createPointsProduct);
router.put('/points/products/:id', ctrl.updatePointsProduct);
router.delete('/points/products/:id', ctrl.deletePointsProduct);
router.put('/points/products/:id/toggle', ctrl.togglePointsProduct);

// Banners
router.get('/banners', ctrl.listBanners);
router.get('/banners/:id', ctrl.getBanner);
router.post('/banners', ctrl.createBanner);
router.put('/banners/:id', ctrl.updateBanner);
router.delete('/banners/:id', ctrl.deleteBanner);
router.put('/banners/:id/toggle', ctrl.toggleBanner);

// File upload & management
router.post('/upload', adminUpload.single('file'), uploadCtrl.uploadImage);
router.get('/files', uploadCtrl.listFiles);
router.delete('/files/:filename', uploadCtrl.deleteFile);

// Settings (system config)
router.get('/settings/pay', ctrl.getPaySettings);
router.put('/settings/pay', ctrl.updatePaySettings);

// Payment records (transaction history)
router.get('/payment-records', ctrl.listPaymentRecords);
router.get('/payment-records/:id', ctrl.getPaymentRecord);

module.exports = router;
