const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const productService = require('../services/productService');
const orderService = require('../services/orderService');
const couponService = require('../services/couponService');
const pointsService = require('../services/pointsService');

// ── Auth ────────────────────────────────────────────
const adminController = {
  // GET /admin/login
  loginPage(req, res) {
    if (req.session.adminUser) return res.redirect('/admin/dashboard');
    res.render('login', { error: null, layout: false });
  },

  // POST /admin/api/login
  async doLogin(req, res) {
    try {
      const { username, password } = req.body;
      const [rows] = await pool.query('SELECT * FROM admin_users WHERE username = ?', [username]);
      if (!rows[0] || !bcrypt.compareSync(password, rows[0].password_hash)) {
        return res.render('login', { error: '用户名或密码错误', layout: false });
      }
      req.session.adminUser = {
        id: rows[0].id,
        username: rows[0].username,
        displayName: rows[0].display_name,
      };
      res.redirect('/admin/dashboard');
    } catch (err) {
      res.render('login', { error: '登录失败', layout: false });
    }
  },

  logout(req, res) {
    req.session.destroy(() => res.redirect('/admin/login'));
  },

  // ── Middleware ───────────────────────────────────
  authRequired(req, res, next) {
    if (!req.session.adminUser) return res.redirect('/admin/login');
    res.locals.adminUser = req.session.adminUser;
    next();
  },

  // ── Dashboard ────────────────────────────────────
  async dashboard(req, res) {
    try {
      const stats = await orderService.getDashboardStats();
      res.render('dashboard', { stats, active: 'dashboard' });
    } catch (err) {
      res.render('dashboard', { stats: { todayOrders: 0, totalUsers: 0, activeCoupons: 0 }, active: 'dashboard' });
    }
  },

  // ── Products ─────────────────────────────────────
  async products(req, res) {
    const products = await productService.adminList();
    res.render('products/list', { products, active: 'products' });
  },

  newProductForm(req, res) {
    res.render('products/form', { product: null, active: 'products', error: null });
  },

  async editProductForm(req, res) {
    const product = await productService.findById(req.params.id);
    if (!product) return res.status(404).send('Product not found');
    res.render('products/form', { product, active: 'products', error: null });
  },

  async createProduct(req, res) {
    try {
      const { category_key, name, desc, detail_desc, price, image, tag, size_desc, ingredients: ingredientsStr } = req.body;
      const ingredients = ingredientsStr ? ingredientsStr.split(/[,，]/).map(s => s.trim()).filter(Boolean) : [];
      await productService.create({ category_key, name, desc, detail_desc, price, image, tag, size_desc, ingredients });
      res.redirect('/admin/products');
    } catch (err) {
      res.render('products/form', { product: req.body, active: 'products', error: err.message });
    }
  },

  async updateProduct(req, res) {
    try {
      const { category_key, name, desc, detail_desc, price, image, tag, size_desc, is_available, ingredients: ingredientsStr } = req.body;
      const ingredients = ingredientsStr ? ingredientsStr.split(/[,，]/).map(s => s.trim()).filter(Boolean) : [];
      await productService.update(req.params.id, {
        category_key, name, desc, detail_desc, price: parseFloat(price), image, tag, size_desc,
        is_available: is_available === '1' ? 1 : 0,
        ingredients,
      });
      res.redirect('/admin/products');
    } catch (err) {
      const product = await productService.findById(req.params.id);
      res.render('products/form', { product, active: 'products', error: err.message });
    }
  },

  async deleteProduct(req, res) {
    await productService.softDelete(req.params.id);
    res.redirect('/admin/products');
  },

  // ── Orders ───────────────────────────────────────
  async orders(req, res) {
    const { status } = req.query;
    const orders = await orderService.adminList({ status });
    res.render('orders/list', { orders, active: 'orders', currentStatus: status || 'all' });
  },

  async orderDetail(req, res) {
    const order = await orderService.findById(req.params.id);
    if (!order) return res.status(404).send('Order not found');
    res.render('orders/detail', { order, active: 'orders' });
  },

  async updateOrderStatus(req, res) {
    await orderService.adminUpdateStatus(req.params.id, req.body.status);
    res.redirect(`/admin/orders/${req.params.id}`);
  },

  // ── Coupons ──────────────────────────────────────
  async coupons(req, res) {
    const [rows] = await pool.query(
      `SELECT c.*, u.name AS user_name FROM coupons c
       JOIN users u ON c.user_id = u.id
       ORDER BY c.created_at DESC LIMIT 100`
    );
    res.render('coupons/list', { coupons: rows, active: 'coupons' });
  },

  // ── Users ────────────────────────────────────────
  async users(req, res) {
    const [rows] = await pool.query(
      `SELECT u.*, COUNT(o.id) AS order_count
       FROM users u LEFT JOIN orders o ON u.id = o.user_id
       GROUP BY u.id ORDER BY u.created_at DESC`
    );
    res.render('users/list', { users: rows, active: 'users' });
  },

  // ── Points Products ──────────────────────────────
  async pointsProducts(req, res) {
    const products = await pointsService.adminProducts();
    res.render('points/list', { products, active: 'points' });
  },

  newPointsProductForm(req, res) {
    res.render('points/form', { product: null, active: 'points', error: null });
  },

  async editPointsProductForm(req, res) {
    const [rows] = await pool.query('SELECT * FROM points_products WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).send('Not found');
    res.render('points/form', { product: rows[0], active: 'points', error: null });
  },

  async createPointsProduct(req, res) {
    try {
      const b = req.body;
      await pointsService.createProduct({
        name: b.name, desc: b.desc, detailDesc: b.detail_desc, points: parseInt(b.points),
        image: b.image, stock: parseInt(b.stock) ?? -1, tag: b.tag,
        highlights: b.highlights ? b.highlights.split(/[,，]/).map(s => s.trim()).filter(Boolean) : [],
        redeemType: b.redeem_type, couponName: b.coupon_name, couponCategory: b.coupon_category,
        couponValue: b.coupon_value, couponDiscountType: b.coupon_discount_type,
        couponDiscountValue: b.coupon_discount_value, couponMinSpend: parseFloat(b.coupon_min_spend) || 0,
        couponValidDays: parseInt(b.coupon_valid_days) || 30, useTip: b.use_tip,
      });
      res.redirect('/admin/points');
    } catch (err) {
      res.render('points/form', { product: req.body, active: 'points', error: err.message });
    }
  },

  async updatePointsProduct(req, res) {
    try {
      const b = req.body;
      await pointsService.updateProduct(req.params.id, {
        name: b.name, desc: b.desc, detail_desc: b.detail_desc, points: parseInt(b.points),
        image: b.image, stock: parseInt(b.stock) ?? -1, tag: b.tag,
        highlights: b.highlights ? b.highlights.split(/[,，]/).map(s => s.trim()).filter(Boolean) : [],
        redeem_type: b.redeem_type, coupon_name: b.coupon_name, coupon_category: b.coupon_category,
        coupon_value: b.coupon_value, coupon_discount_type: b.coupon_discount_type,
        coupon_discount_value: b.coupon_discount_value, coupon_min_spend: parseFloat(b.coupon_min_spend) || 0,
        coupon_valid_days: parseInt(b.coupon_valid_days) || 30, use_tip: b.use_tip,
        is_active: b.is_active === '1' ? 1 : 0,
      });
      res.redirect('/admin/points');
    } catch (err) {
      const [rows] = await pool.query('SELECT * FROM points_products WHERE id = ?', [req.params.id]);
      res.render('points/form', { product: rows[0] || null, active: 'points', error: err.message });
    }
  },
};

module.exports = adminController;
