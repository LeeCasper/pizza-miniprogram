const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const { signToken } = require('../utils/jwt');
const productService = require('../services/productService');
const orderService = require('../services/orderService');
const couponService = require('../services/couponService');
const userService = require('../services/userService');
const pointsService = require('../services/pointsService');
const bannerService = require('../services/bannerService');
const couponTemplateService = require('../services/couponTemplateService');
const memberTierService = require('../services/memberTierService');
const { invalidateCache } = require('../utils/memberTier');
const systemConfigService = require('../services/systemConfigService');

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

  /**
   * PUT /api/v1/admin/products/:id/toggle
   */
  async toggleProduct(req, res) {
    try {
      const product = await productService.toggle(req.params.id);
      if (!product) {
        return res.status(404).json({ code: 404, message: '商品不存在' });
      }
      return res.json({ code: 0, message: '商品状态已切换', data: product });
    } catch (err) {
      console.error('[AdminAPI] ToggleProduct error:', err);
      return res.status(500).json({ code: 500, message: '切换商品状态失败' });
    }
  },

  // ── Orders ──────────────────────────────────────────

  /**
   * GET /api/v1/admin/orders
   * Query: ?status=&page=1&limit=20
   */
  async listOrders(req, res) {
    try {
      const { status, paymentStatus, page = 1, limit = 20 } = req.query;
      const orders = await orderService.adminList({
        status,
        paymentStatus,
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

  /**
   * PUT /api/v1/admin/users/:id
   * Body: { name, phone, points, balance, totalSpent, memberLevel }
   */
  async updateUser(req, res) {
    try {
      const { name, phone, points, balance, totalSpent, memberLevel } = req.body;
      if (memberLevel) {
        const tiers = await memberTierService.getActive();
        const validKeys = tiers.map(t => t.levelKey);
        if (!validKeys.includes(memberLevel)) {
          return res.status(400).json({ code: 400, message: '无效的会员等级' });
        }
      }
      const updateData = {};
      if (name !== undefined) updateData.name = name;
      if (phone !== undefined) updateData.phone = phone;
      if (points !== undefined) updateData.points = points;
      if (balance !== undefined) updateData.balance = balance;
      if (totalSpent !== undefined) updateData.totalSpent = totalSpent;
      if (memberLevel !== undefined) updateData.memberLevel = memberLevel;

      const user = await userService.adminUpdate(req.params.id, updateData);
      if (!user) {
        return res.status(404).json({ code: 404, message: '用户不存在' });
      }
      return res.json({ code: 0, message: '用户信息已更新', data: user });
    } catch (err) {
      console.error('[AdminAPI] UpdateUser error:', err);
      return res.status(500).json({ code: 500, message: err.message || '更新用户失败' });
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

  /**
   * DELETE /api/v1/admin/points/products/:id
   */
  async deletePointsProduct(req, res) {
    try {
      await pointsService.softDelete(req.params.id);
      return res.json({ code: 0, message: '积分商品已下架' });
    } catch (err) {
      console.error('[AdminAPI] DeletePointsProduct error:', err);
      return res.status(500).json({ code: 500, message: '下架积分商品失败' });
    }
  },

  /**
   * PUT /api/v1/admin/points/products/:id/toggle
   */
  async togglePointsProduct(req, res) {
    try {
      await pointsService.toggle(req.params.id);
      return res.json({ code: 0, message: '积分商品状态已切换' });
    } catch (err) {
      console.error('[AdminAPI] TogglePointsProduct error:', err);
      return res.status(500).json({ code: 500, message: '切换积分商品状态失败' });
    }
  },

  // ── Banners CRUD ──────────────────────────────────────

  /**
   * GET /api/v1/admin/banners
   */
  async listBanners(req, res) {
    try {
      const banners = await bannerService.adminList();
      return res.json({ code: 0, data: banners });
    } catch (err) {
      console.error('[AdminAPI] ListBanners error:', err);
      return res.status(500).json({ code: 500, message: '获取轮播图列表失败' });
    }
  },

  /**
   * GET /api/v1/admin/banners/:id
   */
  async getBanner(req, res) {
    try {
      const banner = await bannerService.findById(req.params.id);
      if (!banner) {
        return res.status(404).json({ code: 404, message: '轮播图不存在' });
      }
      return res.json({ code: 0, data: banner });
    } catch (err) {
      console.error('[AdminAPI] GetBanner error:', err);
      return res.status(500).json({ code: 500, message: '获取轮播图失败' });
    }
  },

  /**
   * POST /api/v1/admin/banners
   */
  async createBanner(req, res) {
    try {
      const { imageUrl, title, subtitle, tag, linkType, linkProductId, sortOrder } = req.body;
      const banner = await bannerService.create({
        image_url: imageUrl,
        title,
        subtitle,
        tag,
        link_type: linkType,
        link_product_id: linkProductId,
        sort_order: sortOrder,
      });
      return res.status(201).json({ code: 0, message: '轮播图已创建', data: banner });
    } catch (err) {
      console.error('[AdminAPI] CreateBanner error:', err);
      return res.status(500).json({ code: 500, message: err.message || '创建轮播图失败' });
    }
  },

  /**
   * PUT /api/v1/admin/banners/:id
   */
  async updateBanner(req, res) {
    try {
      const { imageUrl, title, subtitle, tag, linkType, linkProductId, sortOrder, isActive } = req.body;
      const updateData = {};
      if (imageUrl !== undefined) updateData.image_url = imageUrl;
      if (title !== undefined) updateData.title = title;
      if (subtitle !== undefined) updateData.subtitle = subtitle;
      if (tag !== undefined) updateData.tag = tag;
      if (linkType !== undefined) updateData.link_type = linkType;
      if (linkProductId !== undefined) updateData.link_product_id = linkProductId;
      if (sortOrder !== undefined) updateData.sort_order = sortOrder;
      if (isActive !== undefined) updateData.is_active = isActive ? 1 : 0;

      const banner = await bannerService.update(req.params.id, updateData);
      if (!banner) {
        return res.status(404).json({ code: 404, message: '轮播图不存在' });
      }
      return res.json({ code: 0, message: '轮播图已更新', data: banner });
    } catch (err) {
      console.error('[AdminAPI] UpdateBanner error:', err);
      return res.status(500).json({ code: 500, message: err.message || '更新轮播图失败' });
    }
  },

  /**
   * DELETE /api/v1/admin/banners/:id
   */
  async deleteBanner(req, res) {
    try {
      await bannerService.softDelete(req.params.id);
      return res.json({ code: 0, message: '轮播图已下架' });
    } catch (err) {
      console.error('[AdminAPI] DeleteBanner error:', err);
      return res.status(500).json({ code: 500, message: '下架轮播图失败' });
    }
  },

  /**
   * PUT /api/v1/admin/banners/:id/toggle
   */
  async toggleBanner(req, res) {
    try {
      const banner = await bannerService.toggle(req.params.id);
      if (!banner) {
        return res.status(404).json({ code: 404, message: '轮播图不存在' });
      }
      return res.json({ code: 0, message: '轮播图状态已切换', data: banner });
    } catch (err) {
      console.error('[AdminAPI] ToggleBanner error:', err);
      return res.status(500).json({ code: 500, message: '切换轮播图状态失败' });
    }
  },

  // ── Coupon Templates CRUD ──────────────────────────────

  /**
   * GET /api/v1/admin/coupon-templates
   */
  async listCouponTemplates(req, res) {
    try {
      const templates = await couponTemplateService.adminList();
      return res.json({ code: 0, data: templates });
    } catch (err) {
      console.error('[AdminAPI] ListCouponTemplates error:', err);
      return res.status(500).json({ code: 500, message: '获取优惠券模板列表失败' });
    }
  },

  /**
   * GET /api/v1/admin/coupon-templates/:id
   */
  async getCouponTemplate(req, res) {
    try {
      const template = await couponTemplateService.findById(req.params.id);
      if (!template) {
        return res.status(404).json({ code: 404, message: '优惠券模板不存在' });
      }
      return res.json({ code: 0, data: template });
    } catch (err) {
      console.error('[AdminAPI] GetCouponTemplate error:', err);
      return res.status(500).json({ code: 500, message: '获取优惠券模板失败' });
    }
  },

  /**
   * POST /api/v1/admin/coupon-templates
   */
  async createCouponTemplate(req, res) {
    try {
      const { name, desc, category, value, discountType, discountValue,
              minSpend, validDays, color, useTip } = req.body;
      const template = await couponTemplateService.create({
        name,
        desc,
        category,
        value,
        discount_type: discountType,
        discount_value: discountValue,
        min_spend: minSpend,
        valid_days: validDays,
        color,
        use_tip: useTip,
      });
      return res.status(201).json({ code: 0, message: '优惠券模板已创建', data: template });
    } catch (err) {
      console.error('[AdminAPI] CreateCouponTemplate error:', err);
      return res.status(500).json({ code: 500, message: err.message || '创建优惠券模板失败' });
    }
  },

  /**
   * PUT /api/v1/admin/coupon-templates/:id
   */
  async updateCouponTemplate(req, res) {
    try {
      const { name, desc, category, value, discountType, discountValue,
              minSpend, validDays, color, useTip, isActive } = req.body;
      const updateData = {};
      if (name !== undefined) updateData.name = name;
      if (desc !== undefined) updateData.desc = desc;
      if (category !== undefined) updateData.category = category;
      if (value !== undefined) updateData.value = value;
      if (discountType !== undefined) updateData.discount_type = discountType;
      if (discountValue !== undefined) updateData.discount_value = discountValue;
      if (minSpend !== undefined) updateData.min_spend = minSpend;
      if (validDays !== undefined) updateData.valid_days = validDays;
      if (color !== undefined) updateData.color = color;
      if (useTip !== undefined) updateData.use_tip = useTip;
      if (isActive !== undefined) updateData.is_active = isActive ? 1 : 0;

      const template = await couponTemplateService.update(req.params.id, updateData);
      if (!template) {
        return res.status(404).json({ code: 404, message: '优惠券模板不存在' });
      }
      return res.json({ code: 0, message: '优惠券模板已更新', data: template });
    } catch (err) {
      console.error('[AdminAPI] UpdateCouponTemplate error:', err);
      return res.status(500).json({ code: 500, message: err.message || '更新优惠券模板失败' });
    }
  },

  /**
   * DELETE /api/v1/admin/coupon-templates/:id
   */
  async deleteCouponTemplate(req, res) {
    try {
      await couponTemplateService.softDelete(req.params.id);
      return res.json({ code: 0, message: '优惠券模板已下架' });
    } catch (err) {
      console.error('[AdminAPI] DeleteCouponTemplate error:', err);
      return res.status(500).json({ code: 500, message: '删除优惠券模板失败' });
    }
  },

  /**
   * PUT /api/v1/admin/coupon-templates/:id/toggle
   */
  async toggleCouponTemplate(req, res) {
    try {
      const template = await couponTemplateService.toggle(req.params.id);
      if (!template) {
        return res.status(404).json({ code: 404, message: '优惠券模板不存在' });
      }
      return res.json({ code: 0, message: '优惠券模板状态已切换', data: template });
    } catch (err) {
      console.error('[AdminAPI] ToggleCouponTemplate error:', err);
      return res.status(500).json({ code: 500, message: '切换优惠券模板状态失败' });
    }
  },

  // ── Member Tiers CRUD ──────────────────────────────

  /**
   * GET /api/v1/admin/member-tiers
   */
  async listMemberTiers(req, res) {
    try {
      const tiers = await memberTierService.getAll();
      return res.json({ code: 0, data: tiers });
    } catch (err) {
      console.error('[AdminAPI] ListMemberTiers error:', err);
      return res.status(500).json({ code: 500, message: '获取会员等级列表失败' });
    }
  },

  /**
   * GET /api/v1/admin/member-tiers/:id
   */
  async getMemberTier(req, res) {
    try {
      const tier = await memberTierService.getById(req.params.id);
      if (!tier) {
        return res.status(404).json({ code: 404, message: '会员等级不存在' });
      }
      return res.json({ code: 0, data: tier });
    } catch (err) {
      console.error('[AdminAPI] GetMemberTier error:', err);
      return res.status(500).json({ code: 500, message: '获取会员等级失败' });
    }
  },

  /**
   * POST /api/v1/admin/member-tiers
   */
  async createMemberTier(req, res) {
    try {
      const { levelKey, name, levelIndex, minSpent, discountRate,
              pointsRewardRate, birthdayGift, couponValue,
              accentColor, bgStartColor, bgEndColor } = req.body;

      if (!levelKey || !name || levelIndex === undefined) {
        return res.status(400).json({ code: 400, message: '等级标识、名称、序号为必填项' });
      }
      if (discountRate !== undefined && (discountRate < 0 || discountRate > 1)) {
        return res.status(400).json({ code: 400, message: '折扣率需在 0-1 之间' });
      }
      if (pointsRewardRate !== undefined && pointsRewardRate < 1) {
        return res.status(400).json({ code: 400, message: '积分倍率不能低于 1' });
      }

      const tier = await memberTierService.create({
        level_key: levelKey,
        name,
        level_index: levelIndex,
        min_spent: minSpent,
        discount_rate: discountRate,
        points_reward_rate: pointsRewardRate,
        birthday_gift: birthdayGift,
        coupon_value: couponValue,
        accent_color: accentColor,
        bg_start_color: bgStartColor,
        bg_end_color: bgEndColor,
      });
      invalidateCache();
      return res.status(201).json({ code: 0, message: '会员等级已创建', data: tier });
    } catch (err) {
      console.error('[AdminAPI] CreateMemberTier error:', err);
      return res.status(500).json({ code: 500, message: err.message || '创建会员等级失败' });
    }
  },

  /**
   * PUT /api/v1/admin/member-tiers/:id
   */
  async updateMemberTier(req, res) {
    try {
      const { levelKey, name, levelIndex, minSpent, discountRate,
              pointsRewardRate, birthdayGift, couponValue,
              accentColor, bgStartColor, bgEndColor, isActive } = req.body;
      const updateData = {};
      if (levelKey !== undefined) updateData.level_key = levelKey;
      if (name !== undefined) updateData.name = name;
      if (levelIndex !== undefined) updateData.level_index = levelIndex;
      if (minSpent !== undefined) updateData.min_spent = minSpent;
      if (discountRate !== undefined) {
        if (discountRate < 0 || discountRate > 1) {
          return res.status(400).json({ code: 400, message: '折扣率需在 0-1 之间' });
        }
        updateData.discount_rate = discountRate;
      }
      if (pointsRewardRate !== undefined) {
        if (pointsRewardRate < 1) {
          return res.status(400).json({ code: 400, message: '积分倍率不能低于 1' });
        }
        updateData.points_reward_rate = pointsRewardRate;
      }
      if (birthdayGift !== undefined) updateData.birthday_gift = birthdayGift;
      if (couponValue !== undefined) updateData.coupon_value = couponValue;
      if (accentColor !== undefined) updateData.accent_color = accentColor;
      if (bgStartColor !== undefined) updateData.bg_start_color = bgStartColor;
      if (bgEndColor !== undefined) updateData.bg_end_color = bgEndColor;
      if (isActive !== undefined) updateData.is_active = isActive ? 1 : 0;

      const tier = await memberTierService.update(req.params.id, updateData);
      if (!tier) {
        return res.status(404).json({ code: 404, message: '会员等级不存在' });
      }
      invalidateCache();
      return res.json({ code: 0, message: '会员等级已更新', data: tier });
    } catch (err) {
      console.error('[AdminAPI] UpdateMemberTier error:', err);
      return res.status(500).json({ code: 500, message: err.message || '更新会员等级失败' });
    }
  },

  /**
   * DELETE /api/v1/admin/member-tiers/:id
   */
  async deleteMemberTier(req, res) {
    try {
      await memberTierService.softDelete(req.params.id);
      invalidateCache();
      return res.json({ code: 0, message: '会员等级已下架' });
    } catch (err) {
      console.error('[AdminAPI] DeleteMemberTier error:', err);
      return res.status(500).json({ code: 500, message: '删除会员等级失败' });
    }
  },

  /**
   * PUT /api/v1/admin/member-tiers/:id/toggle
   */
  async toggleMemberTier(req, res) {
    try {
      const tier = await memberTierService.toggle(req.params.id);
      if (!tier) {
        return res.status(404).json({ code: 404, message: '会员等级不存在' });
      }
      invalidateCache();
      return res.json({ code: 0, message: '会员等级状态已切换', data: tier });
    } catch (err) {
      console.error('[AdminAPI] ToggleMemberTier error:', err);
      return res.status(500).json({ code: 500, message: '切换会员等级状态失败' });
    }
  },

  /**
   * POST /api/v1/admin/coupons/assign
   * Body: { templateId, userIds: number[] }
   */
  async assignCoupon(req, res) {
    try {
      const { templateId, userIds } = req.body;
      if (!templateId || !Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ code: 400, message: '请选择模板和用户' });
      }

      const template = await couponTemplateService.findById(templateId);
      if (!template) {
        return res.status(404).json({ code: 404, message: '优惠券模板不存在' });
      }

      const now = new Date();
      const validFrom = now.toISOString().slice(0, 10);
      const validTo = new Date(now.getTime() + template.validDays * 86400000).toISOString().slice(0, 10);
      let assigned = 0;

      for (const userId of userIds) {
        const code = `CPN-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
        await pool.query(
          `INSERT INTO coupons (user_id, name, \`desc\`, category, \`value\`, status, code,
           discount_type, discount_value, min_spend, valid_from, valid_to, use_tip, color, source)
           VALUES (?, ?, ?, ?, ?, 'available', ?, ?, ?, ?, ?, ?, ?, ?, 'admin')`,
          [userId, template.name, template.desc, template.category, template.value,
           code, template.discountType, template.discountValue,
           template.minSpend, validFrom, validTo, template.useTip, template.color]
        );
        assigned++;
      }

      return res.json({ code: 0, message: `已成功发放 ${assigned} 张优惠券`, data: { assigned } });
    } catch (err) {
      console.error('[AdminAPI] AssignCoupon error:', err);
      return res.status(500).json({ code: 500, message: err.message || '发放优惠券失败' });
    }
  },

  // ── Settings (System Config) ────────────────────────

  /**
   * GET /api/v1/admin/settings/pay
   * Returns WeChat Pay config with sensitive fields masked.
   */
  async getPaySettings(req, res, next) {
    try {
      const cfg = await systemConfigService.getPayConfig();

      // Mask sensitive fields for display
      const masked = {
        mchId: cfg.mchId,
        apiV3Key: maskSensitive(cfg.apiV3Key, 4, 4),
        certSerialNo: cfg.certSerialNo,
        privateKey: cfg.privateKey ? '已配置' : '未配置',
        platformCert: cfg.platformCert ? '已配置' : '未配置',
        notifyUrl: cfg.notifyUrl,
      };

      masked._hasPrivateKey = !!cfg.privateKey;
      masked._hasPlatformCert = !!cfg.platformCert;

      res.json({ code: 0, data: masked });
    } catch (err) {
      next(err);
    }
  },

  /**
   * PUT /api/v1/admin/settings/pay
   * Body: { mchId, apiV3Key, certSerialNo, privateKey, platformCert, notifyUrl }
   *
   * If apiV3Key === '****' (masked placeholder), keep existing value.
   * If privateKey/platformCert is empty, keep existing value.
   */
  async updatePaySettings(req, res, next) {
    try {
      const body = req.body || {};
      const current = await systemConfigService.getPayConfig();

      const entries = {
        mchId: body.mchId !== undefined ? body.mchId : undefined,
        certSerialNo: body.certSerialNo !== undefined ? body.certSerialNo : undefined,
        notifyUrl: body.notifyUrl !== undefined ? body.notifyUrl : undefined,
      };

      if (body.apiV3Key !== undefined && body.apiV3Key !== '****' && !body.apiV3Key.includes('****')) {
        entries.apiV3Key = body.apiV3Key;
      }

      if (body.privateKey && body.privateKey !== '已配置' && body.privateKey.trim()) {
        entries.privateKey = body.privateKey;
      }

      if (body.platformCert && body.platformCert !== '已配置' && body.platformCert.trim()) {
        entries.platformCert = body.platformCert;
      }

      await systemConfigService.updatePayConfig(entries);

      // Immediately sync to in-memory config and disk cert files
      await systemConfigService.syncPayConfigToMemory();

      res.json({ code: 0, message: '支付配置已保存' });
    } catch (err) {
      next(err);
    }
  },
};

function safeJson(val, defaultVal) {
  if (!val) return defaultVal;
  try { return typeof val === 'string' ? JSON.parse(val) : val; } catch (_) { return defaultVal; }
}

function maskSensitive(value, showPrefix, showSuffix) {
  if (!value) return '';
  if (value.length <= showPrefix + showSuffix) return '****';
  return value.slice(0, showPrefix) + '****' + value.slice(-showSuffix);
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
