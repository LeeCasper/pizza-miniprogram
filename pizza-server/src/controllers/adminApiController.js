const bcrypt = require('bcryptjs');
const config = require('../config');
const pool = require('../config/database');
const { createLogger } = require('../utils/logger');
const log = createLogger('AdminAPI');
const { signToken } = require('../utils/jwt');
const productService = require('../services/productService');
const categoryService = require('../services/categoryService');
const orderService = require('../services/orderService');
const couponService = require('../services/couponService');
const userService = require('../services/userService');
const pointsService = require('../services/pointsService');
const bannerService = require('../services/bannerService');
const couponTemplateService = require('../services/couponTemplateService');
const memberTierService = require('../services/memberTierService');
const { invalidateCache, getTierLevel } = require('../utils/memberTier');
const paymentService = require('../services/paymentService');
const systemConfigService = require('../services/systemConfigService');
const storeService = require('../services/storeService');
const auditService = require('../services/auditService');
const reconciliationService = require('../services/reconciliationService');

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
      log.error({ err }, 'Login error');
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
      log.error({ err }, 'GetProfile error');
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
      log.error({ err }, 'Dashboard stats error');
      return res.status(500).json({ code: 500, message: '获取统计数据失败' });
    }
  },

  /**
   * GET /api/v1/admin/dashboard/charts
   */
  async getDashboardCharts(req, res) {
    try {
      const charts = await orderService.getDashboardCharts();
      return res.json({ code: 0, data: charts });
    } catch (err) {
      log.error({ err }, 'Dashboard charts error');
      return res.status(500).json({ code: 500, message: '获取图表数据失败' });
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
      log.error({ err }, 'ListProducts error');
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
      log.error({ err }, 'GetProduct error');
      return res.status(500).json({ code: 500, message: '获取商品失败' });
    }
  },

  /**
   * POST /api/v1/admin/products
   * Body: { category_key, name, desc, detail_desc, price, image, tag, size_desc, ingredients[] }
   */
  async createProduct(req, res) {
    try {
      const { category_key, name, desc, detail_desc, price, image, tag, size_desc, ingredients, stock } = req.body;
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
        stock: stock !== undefined ? parseInt(stock) : -1,
      });
      return res.status(201).json({ code: 0, message: '商品已创建', data: product });
    } catch (err) {
      log.error({ err }, 'CreateProduct error');
      return res.status(500).json({ code: 500, message: err.message || '创建商品失败' });
    }
  },

  /**
   * PUT /api/v1/admin/products/:id
   */
  async updateProduct(req, res) {
    try {
      const { category_key, name, desc, detail_desc, price, image, tag, size_desc, is_available, ingredients, stock } = req.body;
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
      if (stock !== undefined) updateData.stock = parseInt(stock);

      const product = await productService.update(req.params.id, updateData);
      if (!product) {
        return res.status(404).json({ code: 404, message: '商品不存在' });
      }
      return res.json({ code: 0, message: '商品已更新', data: product });
    } catch (err) {
      log.error({ err }, 'UpdateProduct error');
      return res.status(500).json({ code: 500, message: err.message || '更新商品失败' });
    }
  },

  /**
   * DELETE /api/v1/admin/products/:id
   */
  async deleteProduct(req, res) {
    try {
      await productService.softDelete(req.params.id);
      return res.json({ code: 0, message: '商品已删除' });
    } catch (err) {
      log.error({ err }, 'DeleteProduct error');
      return res.status(500).json({ code: 500, message: '删除商品失败' });
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
      log.error({ err }, 'ToggleProduct error');
      return res.status(500).json({ code: 500, message: '切换商品状态失败' });
    }
  },

  // ── Categories ──────────────────────────────────────

  /**
   * GET /api/v1/admin/categories
   */
  async listCategories(req, res) {
    try {
      const categories = await categoryService.adminList();
      return res.json({ code: 0, data: categories });
    } catch (err) {
      log.error({ err }, 'ListCategories error');
      return res.status(500).json({ code: 500, message: '获取分类列表失败' });
    }
  },

  /**
   * POST /api/v1/admin/categories
   */
  async createCategory(req, res) {
    try {
      const { key, name, icon, sortOrder, isActive } = req.body;
      if (!key || !/^[a-z0-9_]+$/.test(key)) {
        return res.status(400).json({ code: 400, message: '分类标识只能含小写字母、数字、下划线' });
      }
      if (!name || !String(name).trim()) {
        return res.status(400).json({ code: 400, message: '分类名称不能为空' });
      }
      const exists = await categoryService.findByKey(key);
      if (exists) {
        return res.status(400).json({ code: 400, message: '分类标识已存在' });
      }
      const category = await categoryService.create({ key, name: String(name).trim(), icon, sortOrder, isActive });
      return res.json({ code: 0, message: '分类已创建', data: category });
    } catch (err) {
      log.error({ err }, 'CreateCategory error');
      return res.status(500).json({ code: 500, message: '创建分类失败' });
    }
  },

  /**
   * PUT /api/v1/admin/categories/:key
   */
  async updateCategory(req, res) {
    try {
      const exists = await categoryService.findByKey(req.params.key);
      if (!exists) {
        return res.status(404).json({ code: 404, message: '分类不存在' });
      }
      const { name, icon, sortOrder, isActive } = req.body;
      const category = await categoryService.update(req.params.key, { name, icon, sortOrder, isActive });
      return res.json({ code: 0, message: '分类已更新', data: category });
    } catch (err) {
      log.error({ err }, 'UpdateCategory error');
      return res.status(500).json({ code: 500, message: '更新分类失败' });
    }
  },

  /**
   * DELETE /api/v1/admin/categories/:key
   */
  async deleteCategory(req, res) {
    try {
      const count = await categoryService.countProducts(req.params.key);
      if (count > 0) {
        return res.status(400).json({ code: 400, message: `该分类下还有 ${count} 个商品,无法删除` });
      }
      await categoryService.remove(req.params.key);
      return res.json({ code: 0, message: '分类已删除' });
    } catch (err) {
      log.error({ err }, 'DeleteCategory error');
      if (err && (err.errno === 1451 || err.code === 'ER_ROW_IS_REFERENCED_2')) {
        return res.status(400).json({ code: 400, message: '该分类下仍有商品引用,无法删除' });
      }
      return res.status(500).json({ code: 500, message: '删除分类失败' });
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
      log.error({ err }, 'ListOrders error');
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
      log.error({ err }, 'GetOrder error');
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
      if (!status) {
        return res.status(400).json({ code: 400, message: '请提供订单状态' });
      }

      const orderId = req.params.id;

      // If cancelling, check if order was paid to trigger refund
      let refund = null;
      if (status === 'cancelled') {
        const existing = await orderService.findById(orderId);
        if (existing && existing.paymentMethod) {
          let order;
          try {
            order = await orderService.adminUpdateStatus(orderId, status, req.user);
          } catch (err) {
            if (err.code === 'INVALID_TRANSITION') {
              return res.status(400).json({ code: 400, message: err.message });
            }
            throw err;
          }
          if (!order) {
            return res.status(404).json({ code: 404, message: '订单不存在' });
          }
          try {
            const refundService = require('../services/refundService');
            refund = await refundService.refundOrder(orderId, '管理员取消订单');
          } catch (refundErr) {
            log.error({ err: refundErr }, 'Refund failed');
            refund = { success: false, message: refundErr.message };
          }
          return res.json({ code: 0, message: '订单已取消' + (refund?.success ? '，退款已处理' : ''), data: order, refund });
        }
      }

      let order;
      try {
        order = await orderService.adminUpdateStatus(orderId, status, req.user);
      } catch (err) {
        if (err.code === 'INVALID_TRANSITION') {
          return res.status(400).json({ code: 400, message: err.message });
        }
        throw err;
      }
      if (!order) {
        return res.status(404).json({ code: 404, message: '订单不存在' });
      }
      return res.json({ code: 0, message: '订单状态已更新', data: order });
    } catch (err) {
      log.error({ err }, 'UpdateOrderStatus error');
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
      log.error({ err }, 'ListCoupons error');
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
      log.error({ err }, 'ListUsers error');
      return res.status(500).json({ code: 500, message: '获取用户列表失败' });
    }
  },

  /**
   * PUT /api/v1/admin/users/:id
   * Body: { name, phone, points, balance, totalSpent, memberLevel }
   */
  async updateUser(req, res) {
    try {
      const { name, phone, points, balance, totalSpent, totalRecharge, memberLevel } = req.body;
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
      if (totalRecharge !== undefined) updateData.totalRecharge = totalRecharge;

      // 余额或消费金额变动时，自动升级会员等级（仅升不降）
      // 注意：管理后台表单总会发送 memberLevel（即使未改），所以不能用 memberLevel === undefined 判断
      let currentUser = null;
      if (balance !== undefined || totalSpent !== undefined) {
        currentUser = await userService.findById(req.params.id);
        if (currentUser) {
          const newTotalSpent = totalSpent !== undefined ? parseFloat(totalSpent) : parseFloat(currentUser.total_spent || 0);
          const qualifyingAmount = newTotalSpent;
          const computedLevelKey = await getTierLevel(qualifyingAmount);
          // 比较：仅当计算等级高于管理员指定/当前等级时，自动升级
          const tiers = await memberTierService.getActive();
          const targetLevel = updateData.memberLevel || currentUser.member_level || 'silver';
          const targetIdx = tiers.findIndex(t => t.levelKey === targetLevel);
          const computedIdx = tiers.findIndex(t => t.levelKey === computedLevelKey);
          if (computedIdx > targetIdx) {
            updateData.memberLevel = computedLevelKey;
          }
        }
      }

      const user = await userService.adminUpdate(req.params.id, updateData);
      if (!user) {
        return res.status(404).json({ code: 404, message: '用户不存在' });
      }

      // 审计：记录余额/消费/充值调整
      if (balance !== undefined || totalSpent !== undefined || totalRecharge !== undefined) {
        const before = currentUser ? {
          balance: currentUser.balance,
          totalSpent: currentUser.total_spent,
          totalRecharge: currentUser.total_recharge,
          memberLevel: currentUser.member_level,
        } : {};
        await auditService.record({
          actorType: 'admin',
          actorId: req.user.id,
          action: 'user.balance_adjust',
          entityType: 'user',
          entityId: String(req.params.id),
          before,
          after: {
            balance: updateData.balance,
            totalSpent: updateData.totalSpent,
            totalRecharge: updateData.totalRecharge,
            memberLevel: updateData.memberLevel,
          },
        });
      }

      return res.json({ code: 0, message: '用户信息已更新', data: user });
    } catch (err) {
      log.error({ err }, 'UpdateUser error');
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
      log.error({ err }, 'ListPointsProducts error');
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
      log.error({ err }, 'GetPointsProduct error');
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
      log.error({ err }, 'CreatePointsProduct error');
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
      log.error({ err }, 'UpdatePointsProduct error');
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
      log.error({ err }, 'DeletePointsProduct error');
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
      log.error({ err }, 'TogglePointsProduct error');
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
      log.error({ err }, 'ListBanners error');
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
      log.error({ err }, 'GetBanner error');
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
      log.error({ err }, 'CreateBanner error');
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
      log.error({ err }, 'UpdateBanner error');
      return res.status(500).json({ code: 500, message: err.message || '更新轮播图失败' });
    }
  },

  /**
   * DELETE /api/v1/admin/banners/:id
   */
  async deleteBanner(req, res) {
    try {
      await bannerService.remove(req.params.id);
      return res.json({ code: 0, message: '轮播图已删除' });
    } catch (err) {
      log.error({ err }, 'DeleteBanner error');
      return res.status(500).json({ code: 500, message: '删除轮播图失败' });
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
      log.error({ err }, 'ToggleBanner error');
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
      log.error({ err }, 'ListCouponTemplates error');
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
      log.error({ err }, 'GetCouponTemplate error');
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
      log.error({ err }, 'CreateCouponTemplate error');
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
      log.error({ err }, 'UpdateCouponTemplate error');
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
      log.error({ err }, 'DeleteCouponTemplate error');
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
      log.error({ err }, 'ToggleCouponTemplate error');
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
      log.error({ err }, 'ListMemberTiers error');
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
      log.error({ err }, 'GetMemberTier error');
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
      log.error({ err }, 'CreateMemberTier error');
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
      log.error({ err }, 'UpdateMemberTier error');
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
      log.error({ err }, 'DeleteMemberTier error');
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
      log.error({ err }, 'ToggleMemberTier error');
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
      log.error({ err }, 'AssignCoupon error');
      return res.status(500).json({ code: 500, message: err.message || '发放优惠券失败' });
    }
  },

  // ── Payment Records ──────────────────────────────────

  /**
   * GET /api/v1/admin/payment-records
   * Query: ?type=order|recharge&status=pending|success|failed|closed&page=1&limit=20
   */
  async listPaymentRecords(req, res) {
    try {
      const { type, status, page = 1, limit = 20 } = req.query;
      const result = await paymentService.adminList({
        type,
        status,
        page: parseInt(page),
        limit: parseInt(limit),
      });
      return res.json({ code: 0, data: result });
    } catch (err) {
      log.error({ err }, 'ListPaymentRecords error');
      return res.status(500).json({ code: 500, message: '获取交易记录失败' });
    }
  },

  /**
   * GET /api/v1/admin/payment-records/:id
   */
  async getPaymentRecord(req, res) {
    try {
      const record = await paymentService.adminGetById(req.params.id);
      if (!record) {
        return res.status(404).json({ code: 404, message: '交易记录不存在' });
      }
      return res.json({ code: 0, data: record });
    } catch (err) {
      log.error({ err }, 'GetPaymentRecord error');
      return res.status(500).json({ code: 500, message: '获取交易记录失败' });
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

  // ── Printer Settings ─────────────────────────────────

  /**
   * GET /api/v1/admin/settings/printer
   */
  async getPrinterSettings(req, res, next) {
    try {
      const cfg = await systemConfigService.getPrinterConfig();

      res.json({
        code: 0,
        data: {
          enabled: cfg.enabled === 'true',
          appId: cfg.appId || '',
          appSecret: cfg.appSecret ? '****' : '',
          sn: cfg.sn || '',
          pkey: cfg.pkey ? '****' : '',
          apiBase: cfg.apiBase || 'https://open.spyun.net',
          copies: parseInt(cfg.copies, 10) || 1,
          _hasAppSecret: !!cfg.appSecret,
          _hasPkey: !!cfg.pkey,
          // 小票模板
          storeName: cfg.storeName || '',
          footerText: cfg.footerText || '',
          footerTip: cfg.footerTip || '',
          audioEnabled: cfg.audioEnabled === '' ? true : cfg.audioEnabled !== 'false',
        },
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * PUT /api/v1/admin/settings/printer
   */
  async updatePrinterSettings(req, res, next) {
    try {
      const body = req.body || {};
      const current = await systemConfigService.getPrinterConfig();

      const entries = {
        enabled: body.enabled !== undefined ? String(body.enabled) : undefined,
        appId: body.appId !== undefined ? body.appId : undefined,
        sn: body.sn !== undefined ? body.sn : undefined,
        pkey: body.pkey !== undefined ? body.pkey : undefined,
        apiBase: body.apiBase !== undefined ? body.apiBase : undefined,
        copies: body.copies !== undefined ? String(body.copies) : undefined,
        // 小票模板
        storeName: body.storeName !== undefined ? body.storeName : undefined,
        footerText: body.footerText !== undefined ? body.footerText : undefined,
        footerTip: body.footerTip !== undefined ? body.footerTip : undefined,
        audioEnabled: body.audioEnabled !== undefined ? String(body.audioEnabled) : undefined,
      };

      // Masked: keep existing secret unless new one provided
      if (body.appSecret !== undefined && body.appSecret !== '****' && !body.appSecret.includes('****')) {
        entries.appSecret = body.appSecret;
      }

      // Masked: pkey
      if (body.pkey !== undefined && body.pkey !== '****' && !body.pkey.includes('****')) {
        entries.pkey = body.pkey;
      }

      // Remove undefined entries
      Object.keys(entries).forEach(k => {
        if (entries[k] === undefined) delete entries[k];
      });

      if (Object.keys(entries).length > 0) {
        await systemConfigService.updatePrinterConfig(entries);
      }

      res.json({ code: 0, message: '打印机配置已保存' });
    } catch (err) {
      next(err);
    }
  },

  // ── Map Settings ─────────────────────────────────────

  /**
   * GET /api/v1/admin/settings/map
   */
  async getMapSettings(req, res, next) {
    try {
      const cfg = await systemConfigService.getMapConfig();

      res.json({
        code: 0,
        data: {
          tencentKey: cfg.tencentKey ? '****' : '',
          _hasTencentKey: !!cfg.tencentKey,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * PUT /api/v1/admin/settings/map
   */
  async updateMapSettings(req, res, next) {
    try {
      const body = req.body || {};
      const entries = {};

      // Skip masked placeholder
      if (body.tencentKey !== undefined && body.tencentKey !== '****' && !body.tencentKey.includes('****')) {
        entries.tencentKey = body.tencentKey;
      }

      if (Object.keys(entries).length > 0) {
        await systemConfigService.updateMapConfig(entries);
      }

      res.json({ code: 0, message: '地图配置已保存' });
    } catch (err) {
      next(err);
    }
  },

  // ── Store Settings ───────────────────────────────────

  /**
   * GET /api/v1/admin/settings/store
   */
  async getStoreSettings(req, res, next) {
    try {
      const stores = await storeService.findAll();
      const store = stores[0] || null;

      if (!store) {
        return res.json({ code: 0, data: null, message: '暂无门店数据' });
      }

      res.json({ code: 0, data: store });
    } catch (err) {
      next(err);
    }
  },

  /**
   * PUT /api/v1/admin/settings/store
   */
  async updateStoreSettings(req, res, next) {
    try {
      const stores = await storeService.findAll();
      const store = stores[0];

      if (!store) {
        return res.status(404).json({ code: 404, message: '门店不存在' });
      }

      const body = req.body || {};
      const fields = {};

      // Whitelist editable fields
      if (body.name !== undefined) fields.name = body.name;
      if (body.address !== undefined) fields.address = body.address;
      if (body.phone !== undefined) fields.phone = body.phone;
      if (body.business_hours !== undefined) fields.business_hours = body.business_hours;
      if (body.latitude !== undefined) fields.latitude = body.latitude;
      if (body.longitude !== undefined) fields.longitude = body.longitude;
      if (body.pickup_notice !== undefined) fields.pickup_notice = body.pickup_notice;

      if (Object.keys(fields).length > 0) {
        await storeService.update(store.id, fields);
      }

      res.json({ code: 0, message: '门店设置已保存' });
    } catch (err) {
      next(err);
    }
  },
  async testPrinter(req, res, next) {
    try {
      const printerService = require('../services/printerService');

      // 先添加/绑定设备
      if (config.printer.pkey) {
        const addResult = await printerService.addPrinter(
          config.printer.sn,
          config.printer.pkey,
          '披萨店打印机'
        );
        log.info({ addResult }, '添加设备结果');
      }

      const result = await printerService.testPrint();

      if (result.success) {
        res.json({ code: 0, message: result.message });
      } else {
        res.json({ code: 500, message: result.message });
      }
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/v1/admin/settings/printer/preview
   * 返回打印内容预览，不实际打印。
   */
  async printerPreview(req, res, next) {
    try {
      const printerService = require('../services/printerService');
      const preview = printerService.previewContent();
      res.json({ code: 0, data: preview });
    } catch (err) {
      next(err);
    }
  },

  // ── Business Settings ─────────────────────────────────

  /**
   * GET /api/v1/admin/settings/business
   */
  async getBusinessSettings(req, res, next) {
    try {
      const cfg = await systemConfigService.getBusinessConfig();
      res.json({
        code: 0,
        data: {
          orderCancelMinutes: parseInt(cfg.orderCancelMinutes, 10) || config.business.orderCancelMinutes,
          unpaidTimeoutMinutes: parseInt(cfg.unpaidTimeoutMinutes, 10) || config.business.unpaidTimeoutMinutes,
          storeName: cfg.storeName || config.business.storeName,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * PUT /api/v1/admin/settings/business
   */
  async updateBusinessSettings(req, res, next) {
    try {
      const body = req.body || {};
      const entries = {};

      if (body.orderCancelMinutes !== undefined) {
        const v = parseInt(body.orderCancelMinutes, 10);
        if (isNaN(v) || v < 0 || v > 1440) {
          return res.status(400).json({ code: 400, message: '取消时限应在 0-1440 分钟之间' });
        }
        entries.orderCancelMinutes = v;
      }
      if (body.unpaidTimeoutMinutes !== undefined) {
        const v = parseInt(body.unpaidTimeoutMinutes, 10);
        if (isNaN(v) || v < 1 || v > 1440) {
          return res.status(400).json({ code: 400, message: '未支付超时应在 1-1440 分钟之间' });
        }
        entries.unpaidTimeoutMinutes = v;
      }
      if (body.storeName !== undefined) {
        entries.storeName = String(body.storeName).trim();
      }

      if (Object.keys(entries).length > 0) {
        await systemConfigService.updateBusinessConfig(entries);
      }

      res.json({ code: 0, message: '业务配置已保存' });
    } catch (err) {
      next(err);
    }
  },

  // ── Theme Settings ──────────────────────────────────

  /**
   * GET /api/v1/admin/settings/theme
   */
  async getThemeSettings(req, res, next) {
    try {
      const cfg = await systemConfigService.getThemeConfig();
      res.json({
        code: 0,
        data: {
          primaryColor: cfg.primaryColor || config.theme.primaryColor,
          secondaryColor: cfg.secondaryColor || config.theme.secondaryColor,
          tertiaryColor: cfg.tertiaryColor || config.theme.tertiaryColor,
          accentColor: cfg.accentColor || config.theme.accentColor,
          gradientColor1: cfg.gradientColor1 || config.theme.gradientColor1,
          gradientColor2: cfg.gradientColor2 || config.theme.gradientColor2,
          gradientColor3: cfg.gradientColor3 || config.theme.gradientColor3,
          gradientColor4: cfg.gradientColor4 || config.theme.gradientColor4,
          glassIntensity: cfg.glassIntensity || config.theme.glassIntensity,
          pageOverrides: cfg.pageOverrides || config.theme.pageOverrides || {},
        },
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * PUT /api/v1/admin/settings/theme
   */
  async updateThemeSettings(req, res, next) {
    try {
      const body = req.body || {};
      const entries = {};
      const hexPattern = /^#[0-9A-Fa-f]{6}$/;
      const colorFields = [
        'primaryColor', 'secondaryColor', 'tertiaryColor', 'accentColor',
        'gradientColor1', 'gradientColor2', 'gradientColor3', 'gradientColor4',
      ];

      for (const field of colorFields) {
        if (body[field] !== undefined) {
          const v = String(body[field]).trim();
          if (!hexPattern.test(v)) {
            return res.status(400).json({ code: 400, message: `${field} 必须是有效的 HEX 颜色值（如 #FF0000）` });
          }
          entries[field] = v;
        }
      }

      if (body.glassIntensity !== undefined) {
        const v = String(body.glassIntensity).trim();
        if (!['low', 'medium', 'high'].includes(v)) {
          return res.status(400).json({ code: 400, message: '毛玻璃强度必须是 low、medium 或 high' });
        }
        entries.glassIntensity = v;
      }

      // 分页主题覆盖：{ pageKey: { field: hexOrEmpty } }，留空=清除该项=跟随全局
      if (body.pageOverrides !== undefined) {
        const PAGE_KEYS = ['index', 'orders', 'shop', 'profile', 'detail', 'checkout', 'pickup', 'tiers'];
        const OVERRIDE_FIELDS = ['cardColor', 'priceColor', 'navColor', 'buttonColor', 'textColor', 'gradient1', 'gradient2', 'gradient3', 'gradient4'];
        const po = body.pageOverrides;
        if (typeof po !== 'object' || po === null || Array.isArray(po)) {
          return res.status(400).json({ code: 400, message: 'pageOverrides 必须是对象' });
        }
        const cleaned = {};
        for (const pageKey of Object.keys(po)) {
          if (!PAGE_KEYS.includes(pageKey)) {
            return res.status(400).json({ code: 400, message: `未知的页面: ${pageKey}` });
          }
          const pageVal = po[pageKey];
          if (typeof pageVal !== 'object' || pageVal === null || Array.isArray(pageVal)) {
            return res.status(400).json({ code: 400, message: `${pageKey} 配置必须是对象` });
          }
          const cleanedPage = {};
          for (const field of Object.keys(pageVal)) {
            if (!OVERRIDE_FIELDS.includes(field)) {
              return res.status(400).json({ code: 400, message: `${pageKey} 含未知字段: ${field}` });
            }
            const v = pageVal[field] == null ? '' : String(pageVal[field]).trim();
            if (v !== '' && !hexPattern.test(v)) {
              return res.status(400).json({ code: 400, message: `${pageKey}.${field} 必须是有效的 HEX 颜色值（如 #FF0000）` });
            }
            cleanedPage[field] = v;
          }
          cleaned[pageKey] = cleanedPage;
        }
        entries.pageOverrides = cleaned;
      }

      if (Object.keys(entries).length > 0) {
        await systemConfigService.updateThemeConfig(entries);
      }

      res.json({ code: 0, message: '主题配置已保存' });
    } catch (err) {
      next(err);
    }
  },

  // ── Audit Logs ──────────────────────────────────────

  /**
   * GET /api/v1/admin/audit-logs
   * Query: ?entityType=&entityId=&action=&actorType=&page=1&limit=20
   */
  async listAuditLogs(req, res, next) {
    try {
      const { entityType, entityId, action, actorType, page = 1, limit = 20 } = req.query;
      const result = await auditService.query({
        entityType, entityId, action, actorType,
        page: parseInt(page), limit: Math.min(parseInt(limit) || 20, 100),
      });
      res.json({ code: 0, data: result });
    } catch (err) {
      next(err);
    }
  },

  // ── Reconciliation ─────────────────────────────────

  /**
   * GET /api/v1/admin/reconcile
   * Query: ?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD
   */
  async reconcile(req, res, next) {
    try {
      const { dateFrom, dateTo } = req.query;
      if (!dateFrom || !dateTo) {
        return res.status(400).json({ code: 400, message: 'dateFrom and dateTo are required (YYYY-MM-DD)' });
      }
      const result = await reconciliationService.reconcile(dateFrom, dateTo);
      res.json({ code: 0, data: result });
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
