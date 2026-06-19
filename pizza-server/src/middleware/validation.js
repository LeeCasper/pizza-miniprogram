const Joi = require('joi');

const schemas = {
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

  updateSettings: Joi.object({
    notificationEnabled: Joi.boolean().optional(),
    phone: Joi.string().pattern(/^1[3-9]\d{9}$/).optional().allow(''),
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
