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

/**
 * Reverse lookup: kuaidi100 comCode → primary Chinese carrier name.
 * Used to enrich auto-detection results for admin display.
 */
const CODE_TO_NAME = {
  'shunfeng': '顺丰速运',
  'zhongtong': '中通快递',
  'yuantong': '圆通速递',
  'shentong': '申通快递',
  'yunda': '韵达快递',
  'huitongkuaidi': '百世快递',
  'jtexpress': '极兔速递',
  'youzhengguonei': '邮政快递包裹',
  'ems': 'EMS',
  'jd': '京东物流',
  'debangwuliu': '德邦快递',
  'yousukuaidi': '优速快递',
  'tiantian': '天天快递',
  'zhaijisong': '宅急送',
  'cainiao': '菜鸟裹裹',
  'danniao': '丹鸟',
  'fedex': 'FedEx',
  'dhl': 'DHL',
  'ups': 'UPS',
  'tnt': 'TNT',
  'annengwuliu': '安能物流',
  'yimidida': '壹米滴答',
  'kuayue': '跨越速运',
  'lianhaowuliu': '联昊通',
  'suer': '速尔快递',
  'guotongkuaidi': '国通快递',
  'quanfengkuaidi': '全峰快递',
  'kuaijiesudi': '快捷快递',
  'rufengda': '如风达',
  'longbanwuliu': '龙邦物流',
};

/**
 * Look up Chinese carrier name from kuaidi100 comCode.
 * Falls back to returning the raw code if no mapping exists.
 *
 * @param {string|null} code - kuaidi100 company code (e.g. "shunfeng")
 * @returns {string|null}
 */
function getCarrierName(code) {
  if (!code || typeof code !== 'string') return null;
  return CODE_TO_NAME[code.trim().toLowerCase()] || code;
}

// ── Tracking Number Prefix Detection ─────────────────

/**
 * Tracking number prefix → carrier rules.
 * Each rule has one or more letter prefixes to match against
 * the start of the tracking number (case-insensitive).
 *
 * Priority: rules are tested in order; the first match wins.
 * More specific prefixes (longer/more chars) should come first.
 */
const PREFIX_RULES = [
  // 德邦小件 — DPK 前缀
  { prefixes: ['DPK'], name: '德邦快递', comCode: 'debangwuliu' },
  // 德邦大件 — DPL 前缀
  { prefixes: ['DPL'], name: '德邦快递', comCode: 'debangwuliu' },
  // 顺丰 — SF / SFEX
  { prefixes: ['SFEX', 'SF'], name: '顺丰速运', comCode: 'shunfeng' },
  // 京东 — JDX / JD (JDX before JD)
  { prefixes: ['JDX', 'JDV', 'JD'], name: '京东物流', comCode: 'jd' },
  // 极兔 — JT
  { prefixes: ['JT'], name: '极兔速递', comCode: 'jtexpress' },
  // 中通 — ZTO
  { prefixes: ['ZTO'], name: '中通快递', comCode: 'zhongtong' },
  // 申通 — STO
  { prefixes: ['STO'], name: '申通快递', comCode: 'shentong' },
  // 圆通 — YT
  { prefixes: ['YT'], name: '圆通速递', comCode: 'yuantong' },
  // 韵达 — YD
  { prefixes: ['YD'], name: '韵达快递', comCode: 'yunda' },
  // 百世旧单 — HTKY
  { prefixes: ['HTKY'], name: '百世快递', comCode: 'huitongkuaidi' },
  // EMS 国际 — EE/EA/EB/E… 开头 + CN 结尾
  { prefixes: ['EE', 'EA', 'EB', 'EC', 'ED', 'EF', 'EG', 'EH', 'EI', 'EJ', 'EK', 'EL', 'EM', 'EN', 'EO', 'EP', 'EQ', 'ER', 'ES', 'ET', 'EU', 'EV', 'EW', 'EX', 'EY', 'EZ'], name: 'EMS', comCode: 'ems', suffix: 'CN' },
  // 邮政平邮 — KA/PA/XA/SB
  { prefixes: ['KA', 'PA', 'XA', 'SB'], name: '邮政快递包裹', comCode: 'youzhengguonei' },
  // UPS — 1Z 开头
  { prefixes: ['1Z'], name: 'UPS', comCode: 'ups' },
  // 阿里跨境小包 — LP
  { prefixes: ['LP'], name: '菜鸟裹裹', comCode: 'cainiao' },
  // 邮政/EMS 纯数字常见前缀
  { prefixes: ['99', '98', '97', '96', '95'], name: 'EMS', comCode: 'ems' },
];

/**
 * Detect carriers from a tracking number by prefix matching.
 *
 * Returns an array of matched carriers (usually 1, may be more for
 * ambiguous prefixes — the user picks). Matches are tested in rule
 * order; all matches from the first matching rule are returned.
 *
 * @param {string} trackingNo - The tracking number to analyze
 * @returns {Array<{comCode: string, name: string}>}
 */
function detectByTrackingNo(trackingNo) {
  if (!trackingNo || typeof trackingNo !== 'string') return [];

  const num = trackingNo.trim().toUpperCase();
  if (!num) return [];

  for (const rule of PREFIX_RULES) {
    for (const prefix of rule.prefixes) {
      if (!num.startsWith(prefix)) continue;

      // If rule has a suffix requirement, check it
      if (rule.suffix && !num.endsWith(rule.suffix)) continue;

      // All prefixes in this rule share the same carrier info
      return [{ comCode: rule.comCode, name: rule.name }];
    }
  }

  return [];
}

module.exports = { getCarrierCode, getCarrierName, CARRIER_MAP, detectByTrackingNo };
