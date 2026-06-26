/**
 * Carrier Name → 快递100 Company Code Mapping
 *
 * Maps Chinese shipping company names stored in shop_orders.shipping_company
 * to kuaidi100 com codes required by the tracking API.
 *
 * Supports exact match first, then fuzzy (substring) match.
 */

const CARRIER_MAP = {
  // 顺丰
  '顺丰速运': 'shunfeng',
  '顺丰': 'shunfeng',
  '顺丰快递': 'shunfeng',
  // 中通
  '中通快递': 'zhongtong',
  '中通': 'zhongtong',
  // 圆通
  '圆通速递': 'yuantong',
  '圆通': 'yuantong',
  '圆通快递': 'yuantong',
  // 申通
  '申通快递': 'shentong',
  '申通': 'shentong',
  // 韵达
  '韵达快递': 'yunda',
  '韵达': 'yunda',
  '韵达速递': 'yunda',
  // 百世
  '百世快递': 'huitongkuaidi',
  '百世': 'huitongkuaidi',
  '百世汇通': 'huitongkuaidi',
  // 极兔
  '极兔速递': 'jtexpress',
  '极兔': 'jtexpress',
  '极兔快递': 'jtexpress',
  'J&T': 'jtexpress',
  // 邮政
  '邮政快递包裹': 'youzhengguonei',
  '邮政': 'youzhengguonei',
  '中国邮政': 'youzhengguonei',
  '邮政包裹': 'youzhengguonei',
  // EMS
  'EMS': 'ems',
  'ems': 'ems',
  '邮政EMS': 'ems',
  '中国邮政EMS': 'ems',
  // 京东
  '京东物流': 'jd',
  '京东': 'jd',
  '京东快递': 'jd',
  // 德邦
  '德邦快递': 'debangwuliu',
  '德邦': 'debangwuliu',
  '德邦物流': 'debangwuliu',
  // 优速
  '优速快递': 'yousukuaidi',
  '优速': 'yousukuaidi',
  // 天天
  '天天快递': 'tiantian',
  '天天': 'tiantian',
  // 宅急送
  '宅急送': 'zhaijisong',
  // 菜鸟
  '菜鸟裹裹': 'cainiao',
  '菜鸟': 'cainiao',
  // 丹鸟
  '丹鸟': 'danniao',
  '丹鸟物流': 'danniao',
  // 国际快递
  'FedEx': 'fedex',
  'fedex': 'fedex',
  'DHL': 'dhl',
  'dhl': 'dhl',
  'UPS': 'ups',
  'ups': 'ups',
  'TNT': 'tnt',
  'tnt': 'tnt',
  // 其他常见
  '安能物流': 'annengwuliu',
  '安能': 'annengwuliu',
  '壹米滴答': 'yimidida',
  '跨越速运': 'kuayue',
  '跨越': 'kuayue',
  '联昊通': 'lianhaowuliu',
  '速尔快递': 'suer',
  '速尔': 'suer',
  '国通快递': 'guotongkuaidi',
  '国通': 'guotongkuaidi',
  '全峰快递': 'quanfengkuaidi',
  '全峰': 'quanfengkuaidi',
  '快捷快递': 'kuaijiesudi',
  '如风达': 'rufengda',
  '龙邦物流': 'longbanwuliu',
  '龙邦': 'longbanwuliu',
};

/**
 * Look up kuaidi100 company code from DB shipping_company value.
 * - Exact match first
 * - Then fuzzy: if DB value contains a known key or vice versa
 * - Returns null if no match (caller may try auto-detection)
 *
 * @param {string|null} shippingCompany - The carrier name from shop_orders
 * @returns {string|null} kuaidi100 com code, or null
 */
function getCarrierCode(shippingCompany) {
  if (!shippingCompany || typeof shippingCompany !== 'string') return null;

  const trimmed = shippingCompany.trim();
  if (!trimmed) return null;

  // Exact match
  if (CARRIER_MAP[trimmed]) return CARRIER_MAP[trimmed];

  // Case-insensitive exact match
  const lower = trimmed.toLowerCase();
  for (const [name, code] of Object.entries(CARRIER_MAP)) {
    if (name.toLowerCase() === lower) return code;
  }

  // Fuzzy: DB value contains a known name
  for (const [name, code] of Object.entries(CARRIER_MAP)) {
    if (trimmed.includes(name) || name.includes(trimmed)) {
      return code;
    }
  }

  return null;
}

module.exports = { getCarrierCode, CARRIER_MAP };
