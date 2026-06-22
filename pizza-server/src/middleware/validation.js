const Joi = require('joi');

const schemas = {
  luckyDraw: Joi.object({
    source: Joi.string().valid('free', 'points').required(),
  }),
  createAddress: Joi.object({
    name: Joi.string().required().max(50).messages({
      'string.empty': '请输入收货人姓名',
      'string.max': '姓名不能超过50个字符',
    }),
    phone: Joi.string().pattern(/^1[3-9]\d{9}$/).required().messages({
      'string.pattern.base': '请输入正确的手机号',
      'string.empty': '请输入手机号',
    }),
    province: Joi.string().required().messages({ 'string.empty': '请选择省份' }),
    city: Joi.string().required().messages({ 'string.empty': '请选择城市' }),
    district: Joi.string().required().messages({ 'string.empty': '请选择区县' }),
    detail: Joi.string().required().max(200).messages({
      'string.empty': '请输入详细地址',
      'string.max': '详细地址不能超过200个字符',
    }),
    tag: Joi.string().valid('', '家', '公司', '学校').default(''),
    isDefault: Joi.boolean().default(false),
  }),

  updateAddress: Joi.object({
    name: Joi.string().required().max(50),
    phone: Joi.string().pattern(/^1[3-9]\d{9}$/).required(),
    province: Joi.string().required(),
    city: Joi.string().required(),
    district: Joi.string().required(),
    detail: Joi.string().required().max(200),
    tag: Joi.string().valid('', '家', '公司', '学校').default(''),
    isDefault: Joi.boolean().default(false),
  }),

  updateProfile: Joi.object({
    name: Joi.string().max(50).messages({ 'string.max': '姓名不能超过50个字符' }),
    bio: Joi.string().max(200).messages({ 'string.max': '简介不能超过200个字符' }),
    birthday: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).allow('', null).messages({
      'string.pattern.base': '生日格式应为 YYYY-MM-DD',
    }),
  }),

  addCartItem: Joi.object({
    productId: Joi.number().integer().positive().required(),
    quantity: Joi.number().integer().min(1).max(99).default(1),
    restrictions: Joi.array().items(Joi.string()).default([]),
  }),

  updateCartItem: Joi.object({
    quantity: Joi.number().integer().min(1).max(99).required(),
    restrictions: Joi.array().items(Joi.string()).default([]),
  }),

  createOrder: Joi.object({
    couponId: Joi.number().integer().positive().optional(),
    note: Joi.string().max(500).optional().allow(''),
    paymentMethod: Joi.string().valid('wechat', 'balance').optional().default('wechat'),
  }),

  redeemPoints: Joi.object({
    productId: Joi.number().integer().positive().required(),
  }),

  couponTemplate: Joi.object({
    name: Joi.string().required().max(100).messages({ 'string.empty': '请输入模板名称' }),
    desc: Joi.string().allow('').max(200).default(''),
    category: Joi.string().valid('discount', 'redeem').default('discount'),
    value: Joi.string().allow('').max(100).default(''),
    discountType: Joi.string().valid('free_redeem','buy_one_get_one','free_delivery','half_price','fixed_amount','percentage').default('fixed_amount'),
    discountValue: Joi.string().allow('').max(100).default(''),
    minSpend: Joi.number().min(0).default(0),
    validDays: Joi.number().integer().min(1).default(30),
    color: Joi.string().allow('').max(20).default('#D32F2F'),
    useTip: Joi.string().allow('').max(300).default(''),
    isActive: Joi.boolean().optional(),
    claimable: Joi.boolean().default(false),
    totalStock: Joi.number().integer().min(0).allow(null).default(null),
    perUserLimit: Joi.number().integer().min(1).default(1),
    claimPeriod: Joi.string().valid('none','weekly','monthly').default('none'),
    minMemberLevel: Joi.number().integer().min(0).default(0),
    maxDiscount: Joi.number().min(0).allow(null).default(null),
  }),

  // Partial-update schema: mirrors couponTemplate's fields/constraints but every field is
  // optional with NO .default(...). This prevents Joi from injecting values for omitted keys,
  // which (combined with the controller's `if (x !== undefined)` guards) would otherwise reset
  // unrelated fields to defaults on a partial PUT. name is optional here (not required).
  couponTemplateUpdate: Joi.object({
    name: Joi.string().optional().max(100).messages({ 'string.empty': '请输入模板名称' }),
    desc: Joi.string().allow('').max(200).optional(),
    category: Joi.string().valid('discount', 'redeem').optional(),
    value: Joi.string().allow('').max(100).optional(),
    discountType: Joi.string().valid('free_redeem','buy_one_get_one','free_delivery','half_price','fixed_amount','percentage').optional(),
    discountValue: Joi.string().allow('').max(100).optional(),
    minSpend: Joi.number().min(0).optional(),
    validDays: Joi.number().integer().min(1).optional(),
    color: Joi.string().allow('').max(20).optional(),
    useTip: Joi.string().allow('').max(300).optional(),
    isActive: Joi.boolean().optional(),
    claimable: Joi.boolean().optional(),
    totalStock: Joi.number().integer().min(0).allow(null).optional(),
    perUserLimit: Joi.number().integer().min(1).optional(),
    claimPeriod: Joi.string().valid('none','weekly','monthly').optional(),
    minMemberLevel: Joi.number().integer().min(0).optional(),
    maxDiscount: Joi.number().min(0).allow(null).optional(),
  }),

  updateSettings: Joi.object({
    notificationEnabled: Joi.boolean().optional(),
    phone: Joi.string().pattern(/^1[3-9]\d{9}$/).optional().allow(''),
  }),

  claimCoupon: Joi.object({
    templateId: Joi.number().integer().positive().required().messages({ 'any.required': '缺少模板ID' }),
  }),
};

function validate(schemaName) {
  const schema = schemas[schemaName];
  if (!schema) {
    throw new Error(`Validation schema "${schemaName}" not found`);
  }
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, { stripUnknown: true });
    if (error) {
      return res.status(400).json({ code: 400, message: error.details[0].message });
    }
    req.body = value;
    next();
  };
}

module.exports = { validate };
