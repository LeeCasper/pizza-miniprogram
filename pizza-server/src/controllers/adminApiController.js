const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const { signToken } = require('../utils/jwt');
const productService = require('../services/productService');
const orderService = require('../services/orderService');
const couponService = require('../services/couponService');
const userService = require('../services/userService');
const pointsService = require('../services/pointsService');

const adminApiController = {
  // ── Auth ────────────────────────────────────────────

  /**
   * POST /api/v1/admin/login (public)
   * Body: { username, password }
   * Returns: { code, data: { token, user } }
   */
  async login(req, res) {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ code: 400, message: '请输入用户名和密码' });
      }

      const [rows] = await pool.query(
        'SELECT * FROM admin_users WHERE username = ?',
        [username]
      );

      if (!rows[0] || !bcrypt.compareSync(password, rows[0].password_hash)) {
        return res.status(401).json({ code: 401, message: '用户名或密码错误' });
      }

      const adminUser = rows[0];
      const payload = {
        sub: adminUser.id,
        role: 'admin',
        username: adminUser.username,
      };
      const token = signToken(payload);

      return res.json({
        code: 0,
        message: '登录成功',
        data: {
          token,
          user: {
            id: adminUser.id,
            username: adminUser.username,
            displayName: adminUser.display_name,
          },
        },
      });
    } catch (err) {
      console.error('[AdminAPI] Login error:', err);
      return res.status(500).json({ code: 500, message: '登录失败' });
    }
  },

  /**
   * GET /api/v1/admin/profile
   */
  async getProfile(req, res) {
    try {
      const [rows] = await pool.query(
        'SELECT id, username, display_name, created_at FROM admin_users WHERE id = ?',
        [req.user.id]
      );
      if (!rows[0]) {
        return res.status(404).json({ code: 404, message: '管理员不存在' });
      }
      return res.json({
        code: 0,
        data: {
          id: rows[0].id,
          username: rows[0].username,
          displayName: rows[0].display_name,
          createdAt: rows[0].created_at,
        },
      });
    } catch (err) {
      console.error('[AdminAPI] GetProfile error:', err);
      return res.status(500).json({ code: 500, message: '获取管理员信息失败' });
    }
  },

  // ── Dashboard ───────────────────────────────────────

  /**
   * GET /api/v1/admin/dashboard/stats
   */
  async getDashboardStats(req, res) {
    try {
      const stats = await orderService.getDashboardStats();
      return res.json({ code: 0, data: stats });
    } catch (err) {
      console.error('[AdminAPI] Dashboard stats error:', err);
      return res.status(500).json({ code: 500, message: '获取统计数据失败' });
    }
  },

  // ── Products CRUD ──────────────────────────────────

  /**
   * GET /api/v1/admin/products
   * Query: ?page=1&limit=20&search=
   */
  async listProducts(req, res) {
    try {
      const products = await productService.adminList();
      return res.json({ code: 0, data: products });
    } catch (err) {
      console.error('[AdminAPI] ListProducts error:', err);
      return res.status(500).json({ code: 500, message: '获取商品列表失败' });
    }
  },

  /**
   * GET /api/v1/admin/products/:id
   */
  async getProduct(req, res) {
    try {
      const product = await productService.findById(req.params.id);
      if (!product) {
        return res.status(404).json({ code: 404, message: '商品不存在' });
      }
      return res.json({ code: 0, data: product });
    } catch (err) {
      console.error('[AdminAPI] GetProduct error:', err);
      return res.status(500).json({ code: 500, message: '获取商品失败' });
    }
  },

  /**
   * POST /api/v1/admin/products
   * Body: { category_key, name, desc, detail_desc, price, image, tag, size_desc, ingredients[] }
   */
  async createProduct(req, res) {
    try {
      const { category_key, name, desc, detail_desc, price, image, tag, size_desc, ingredients } = req.body;
      const product = await productService.create({
        category_key,
        name,
        desc,
        detail_desc,
        price: parseFloat(price),
        image,
        tag,
        size_desc,
        ingredients: Array.isArray(ingredients) ? ingredients : [],
      });
      return res.status(201).json({ code: 0, message: '商品已创建', data: product });
    } catch (err) {
      console.error('[AdminAPI] CreateProduct error:', err);
      return res.status(500).json({ code: 500, message: err.message || '创建商品失败' });
    }
  },

  /**
   * PUT /api/v1/admin/products/:id
   */
  async updateProduct(req, res) {
    try {
      const { category_key, name, desc, detail_desc, price, image, tag, size_desc, is_available, ingredients } = req.body;
      const updateData = {};
      if (category_key !== undefined) updateData.category_key = category_key;
      if (name !== undefined) updateData.name = name;
      if (desc !== undefined) updateData.desc = desc;
      if (detail_desc !== undefined) updateData.detail_desc = detail_desc;
      if (price !== undefined) updateData.price = parseFloat(price);
      if (image !== undefined) updateData.image = image;
      if (tag !== undefined) updateData.tag = tag;
      if (size_desc !== undefined) updateData.size_desc = size_desc;
      if (is_available !== undefined) updateData.is_available = is_available ? 1 : 0;
      if (ingredients !== undefined) updateData.ingredients = Array.isArray(ingredients) ? ingredients : [];

      const product = await productService.update(req.params.id, updateData);
      if (!product) {
        return res.status(404).json({ code: 404, message: '商品不存在' });
      }
      return res.json({ code: 0, message: '商品已更新', data: product });
    } catch (err) {
      console.error('[AdminAPI] UpdateProduct error:', err);
      return res.status(500).json({ code: 500, message: err.message || '更新商品失败' });
    }
  },

  /**
   * DELETE /api/v1/admin/products/:id
   */
  async deleteProduct(req, res) {
    try {
      await productService.softDelete(req.params.id);
      return res.json({ code: 0, message: '商品已下架' });
    } catch (err) {
      console.error('[AdminAPI] DeleteProduct error:', err);
      return res.status(500).json({ code: 500, message: '下架商品失败' });
    }
  },

  // ── Orders ──────────────────────────────────────────

  /**
   * GET /api/v1/admin/orders
   * Query: ?status=&page=1&limit=20
   */
  async listOrders(req, res) {
    try {
      const { status, page = 1, limit = 20 } = req.query;
      const orders = await orderService.adminList({
        status,
        page: parseInt(page),
        limit: parseInt(limit),
      });
      return res.json({ code: 0, data: orders });
    } catch (err) {
      console.error('[AdminAPI] ListOrders error:', err);
      return res.status(500).json({ code: 500, message: '获取订单列表失败' });
    }
  },

  /**
   * GET /api/v1/admin/orders/:id
   */
  async getOrder(req, res) {
    try {
      const order = await orderService.findById(req.params.id);
      if (!order) {
        return res.status(404).json({ code: 404, message: '订单不存在' });
      }
      return res.json({ code: 0, data: order });
    } catch (err) {
      console.error('[AdminAPI] GetOrder error:', err);
      return res.status(500).json({ code: 500, message: '获取订单失败' });
    }
  },

  /**
   * PUT /api/v1/admin/orders/:id/status
   * Body: { status }
   */
  async updateOrderStatus(req, res) {
    try {
      const { status } = req.body;
      const validStatuses = ['waiting', 'preparing', 'completed', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ code: 400, message: '无效的状态值' });
      }
      const order = await orderService.adminUpdateStatus(req.params.id, status);
      if (!order) {
        return res.status(404).json({ code: 404, message: '订单不存在' });
      }
      return res.json({ code: 0, message: '订单状态已更新', data: order });
    } catch (err) {
      console.error('[AdminAPI] UpdateOrderStatus error:', err);
      return res.status(500).json({ code: 500, message: '更新订单状态失败' });
    }
  },

  // ── Coupons ────────────────────────────────────────

  /**
   * GET /api/v1/admin/coupons
   * Query: ?page=1&limit=20&status=&category=
   */
  async listCoupons(req, res) {
    try {
      const { status, category, page = 1, limit = 20 } = req.query;
      const result = await couponService.adminList({
        status,
        category,
        page: parseInt(page),
        limit: parseInt(limit),
      });
      return res.json({ code: 0, data: result });
    } catch (err) {
      console.error('[AdminAPI] ListCoupons error:', err);
      return res.status(500).json({ code: 500, message: '获取优惠券列表失败' });
    }
  },

  // ── Users ───────────────────────────────────────────

  /**
   * GET /api/v1/admin/users
   * Query: ?page=1&limit=20&search=
   */
  async listUsers(req, res) {
    try {
      const { search, page = 1, limit = 20 } = req.query;
      const result = await userService.adminList({
        search,
        page: parseInt(page),
        limit: parseInt(limit),
      });
      return res.json({ code: 0, data: result });
    } catch (err) {
      console.error('[AdminAPI] ListUsers error:', err);
      return res.status(500).json({ code: 500, message: '获取用户列表失败' });
    }
  },

  // ── Points Products CRUD ────────────────────────────

  /**
   * GET /api/v1/admin/points/products
   */
  async listPointsProducts(req, res) {
    try {
      const products = await pointsService.adminProducts();
      return res.json({ code: 0, data: products });
    } catch (err) {
      console.error('[AdminAPI] ListPointsProducts error:', err);
      return res.status(500).json({ code: 500, message: '获取积分商品列表失败' });
    }
  },

  /**
   * GET /api/v1/admin/points/products/:id
   */
  async getPointsProduct(req, res) {
    try {
      const [rows] = await pool.query('SELECT * FROM points_products WHERE id = ?', [req.params.id]);
      if (!rows[0]) {
        return res.status(404).json({ code: 404, message: '积分商品不存在' });
      }
      return res.json({ code: 0, data: formatPointsProduct(rows[0]) });
    } catch (err) {
      console.error('[AdminAPI] GetPointsProduct error:', err);
      return res.status(500).json({ code: 500, message: '获取积分商品失败' });
    }
  },

  /**
   * POST /api/v1/admin/points/products
   */
  async createPointsProduct(req, res) {
    try {
      const b = req.body;
      const id = await pointsService.createProduct({
        name: b.name,
        desc: b.desc,
        detailDesc: b.detailDesc,
        points: parseInt(b.points),
        image: b.image,
        stock: parseInt(b.stock) ?? -1,
        tag: b.tag,
        highlights: Array.isArray(b.highlights) ? b.highlights : [],
        redeemType: b.redeemType,
        couponName: b.couponName,
        couponCategory: b.couponCategory,
        couponValue: b.couponValue,
        couponDiscountType: b.couponDiscountType,
        couponDiscountValue: b.couponDiscountValue,
        couponMinSpend: parseFloat(b.couponMinSpend) || 0,
        couponValidDays: parseInt(b.couponValidDays) || 30,
        useTip: b.useTip,
      });
      return res.status(201).json({ code: 0, message: '积分商品已创建', data: { id } });
    } catch (err) {
      console.error('[AdminAPI] CreatePointsProduct error:', err);
      return res.status(500).json({ code: 500, message: err.message || '创建积分商品失败' });
    }
  },

  /**
   * PUT /api/v1/admin/points/products/:id
   */
  async updatePointsProduct(req, res) {
    try {
      const b = req.body;
      const updateData = {};
      // Map camelCase (from JSON API) to snake_case (for service layer)
      const fieldMap = {
        name: 'name', desc: 'desc', detailDesc: 'detail_desc', image: 'image', tag: 'tag',
        redeemType: 'redeem_type', couponName: 'coupon_name', couponCategory: 'coupon_category',
        couponValue: 'coupon_value', couponDiscountType: 'coupon_discount_type',
        couponDiscountValue: 'coupon_discount_value', useTip: 'use_tip',
      };
      for (const [camel, snake] of Object.entries(fieldMap)) {
        if (b[camel] !== undefined) updateData[snake] = b[camel];
      }
      if (b.points !== undefined) updateData.points = parseInt(b.points);
      if (b.stock !== undefined) updateData.stock = parseInt(b.stock);
      if (b.isActive !== undefined) updateData.is_active = b.isActive ? 1 : 0;
      if (b.highlights !== undefined) updateData.highlights = Array.isArray(b.highlights) ? b.highlights : [];
      if (b.couponMinSpend !== undefined) updateData.coupon_min_spend = parseFloat(b.couponMinSpend);
      if (b.couponValidDays !== undefined) updateData.coupon_valid_days = parseInt(b.couponValidDays);

      await pointsService.updateProduct(req.params.id, updateData);
      return res.json({ code: 0, message: '积分商品已更新' });
    } catch (err) {
      console.error('[AdminAPI] UpdatePointsProduct error:', err);
      return res.status(500).json({ code: 500, message: err.message || '更新积分商品失败' });
    }
  },
};

function safeJson(val, defaultVal) {
  if (!val) return defaultVal;
  try { return typeof val === 'string' ? JSON.parse(val) : val; } catch (_) { return defaultVal; }
}

function formatPointsProduct(row) {
  return {
    id: row.id,
    name: row.name,
    desc: row.desc,
    detailDesc: row.detail_desc,
    points: row.points,
    image: row.image,
    stock: row.stock,
    tag: row.tag,
    highlights: safeJson(row.highlights, []),
    redeemType: row.redeem_type,
    couponName: row.coupon_name,
    couponCategory: row.coupon_category,
    couponValue: row.coupon_value,
    couponDiscountType: row.coupon_discount_type,
    couponDiscountValue: row.coupon_discount_value,
    couponMinSpend: parseFloat(row.coupon_min_spend || 0),
    couponValidDays: row.coupon_valid_days,
    useTip: row.use_tip,
    isActive: !!row.is_active,
  };
}

module.exports = adminApiController;
