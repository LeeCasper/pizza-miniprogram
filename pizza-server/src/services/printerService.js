/**
 * Printer Service — 商鹏云打印机
 *
 * API 文档: https://www.spyun.net.cn/open/index.html
 * API 地址: https://open.spyun.net
 *
 * 鉴权: appid + timestamp + MD5 签名
 * 打印: POST /v1/printer/print (application/x-www-form-urlencoded)
 * 添加设备: POST /v1/printer/add
 */

const crypto = require('crypto');
const config = require('../config');
const { createLogger } = require('../utils/logger');
const log = createLogger('Printer');

// ── 签名生成 ──────────────────────────────────────────

/**
 * 生成 MD5 签名。
 * 1. 将所有非空参数按 key ASCII 排序 → key1=value1&key2=value2...
 * 2. 末尾拼接 &appsecret=XXX
 * 3. MD5 后转为大写
 */
function buildSign(params, appSecret) {
  const sortedKeys = Object.keys(params)
    .filter(k => params[k] !== '' && params[k] !== null && params[k] !== undefined)
    .sort();

  const stringA = sortedKeys.map(k => `${k}=${params[k]}`).join('&');
  const stringSignTemp = stringA + '&appsecret=' + appSecret;

  return crypto.createHash('md5').update(stringSignTemp, 'utf8').digest('hex').toUpperCase();
}

// ── HTTP 请求封装 ────────────────────────────────────

/**
 * 发送 application/x-www-form-urlencoded 请求到商鹏 API。
 */
async function apiRequest(path, bodyParams) {
  // 构建 URL-encoded body
  const parts = [];
  for (const [k, v] of Object.entries(bodyParams)) {
    if (v !== null && v !== undefined) {
      parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(String(v)));
    }
  }
  const body = parts.join('&');

  // 强制使用商鹏云打印正确地址（防止 DB 配置了错误的旧地址）
  const CORRECT_HOST = 'open.spyun.net';
  let apiBase = config.printer.apiBase || 'https://open.spyun.net';
  let url = new URL(path, apiBase);
  if (url.hostname !== CORRECT_HOST) {
    log.warn({ apiBase, correctHost: CORRECT_HOST }, 'apiBase 指向错误主机，强制纠正');
    url = new URL(path, 'https://' + CORRECT_HOST);
  }

  log.info({ url: url.href }, 'POST request');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(url.href, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: controller.signal,
    });

    const text = await res.text();
    log.info({ url: url.href, httpStatus: res.status, body: text.slice(0, 500) }, 'API response');

    try {
      return JSON.parse(text);
    } catch (_) {
      return { raw: text, httpStatus: res.status };
    }
  } catch (err) {
    log.error({ err, url: url.href }, 'API request error');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ── 签名参数构建 ──────────────────────────────────────

/**
 * 构建带签名的完整请求参数。
 */
function buildSignedParams(params) {
  const appId = config.printer.appId;
  const appSecret = config.printer.appSecret;
  const timestamp = Math.floor(Date.now() / 1000);

  const signParams = { appid: appId, timestamp, ...params };
  const sign = buildSign(signParams, appSecret);

  return { ...signParams, sign };
}

// ── 打印内容构建（商鹏标签格式）─────────────────────

/**
 * 根据订单数据构建商鹏标签格式的打印内容。
 * 文档: 商鹏排版控制标签 — <BR>, <C>, <B>, <L1>, <CUT>, <AUDIO-COMMON> 等
 */
function buildOrderContent(order) {
  const now = new Date();
  const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // 从配置读取可自定义内容
  const storeName = config.printer.storeName || '王姐手工披萨';
  const footerText = config.printer.footerText || '感谢您的光临！';
  const footerTip = config.printer.footerTip || '请到取餐口出示取餐码';
  const audioEnabled = config.printer.audioEnabled !== false;

  const paymentMethod = order.paymentMethod || order.payment_method || '';
  const payLabel = paymentMethod === 'balance' ? '余额支付' : paymentMethod === 'wechat' ? '微信支付' : '待支付';
  const pickupCode = order.pickupCode || order.pickup_code || '—';

  const lines = [];

  // 标题
  lines.push(`<C><B><L1>${storeName}</L1></B></C>`);
  lines.push('<C>——————————————</C>');
  lines.push(`<C>取餐码</C>`);
  lines.push(`<C><L2>${pickupCode}</L2></C>`);
  lines.push('<C>——————————————</C>');
  lines.push(`<BR>`);

  // 订单信息
  lines.push(`订单号：${order.id}<BR>`);
  lines.push(`下单时间：${timeStr}<BR>`);
  lines.push(`支付方式：${payLabel}<BR>`);
  if (order.note) {
    lines.push(`备注：${order.note}<BR>`);
  }
  lines.push(`<BR>`);

  // 分隔线
  lines.push('——————————————<BR>');
  lines.push('<B>商品名称        数量  金额</B><BR>');
  lines.push('——————————————<BR>');

  // 商品列表（含忌口/过敏选项）
  const items = order.items || [];
  let total = 0;
  for (const item of items) {
    const name = (item.productName || item.product_name || item.name || '—').slice(0, 14);
    const qty = String(item.quantity || 1);
    const price = parseFloat(item.price || 0);
    const lineTotal = price * (item.quantity || 1);
    total += lineTotal;
    // 名称左对齐补空格到14字符宽度（近似等宽字体）
    const paddedName = name + ' '.repeat(Math.max(0, 14 - name.length));
    lines.push(`${paddedName} x${qty}  ￥${lineTotal.toFixed(2)}<BR>`);

    // 显示忌口/过敏选项
    const restrictions = item.restrictions || [];
    if (restrictions.length > 0) {
      lines.push(`  └ 忌口: ${restrictions.join(', ')}<BR>`);
    }
  }

  lines.push('——————————————<BR>');

  // 金额汇总
  const discount = parseFloat(order.discountAmount || order.discount_amount || 0);
  lines.push(`商品合计：￥${total.toFixed(2)}<BR>`);
  if (discount > 0) {
    lines.push(`优惠减免：-￥${discount.toFixed(2)}<BR>`);
  }
  const paid = parseFloat(order.paidAmount || order.paid_amount || total);
  lines.push(`<B><L1>实付：￥${paid.toFixed(2)}</L1></B><BR>`);
  lines.push(`<BR>`);

  // 页脚
  lines.push('<C>——————————————</C>');
  lines.push(`<C>${footerText}</C>`);
  lines.push(`<C>${footerTip}</C>`);
  lines.push(`<BR>`);

  // 语音播报
  if (audioEnabled) {
    lines.push('<AUDIO-COMMON>');
  }

  return lines.join('');
}

// ── 公共接口 ─────────────────────────────────────────

const printerService = {

  /**
   * 添加/绑定打印机设备。
   * 必须先调用此接口才能在打印接口中使用此设备。
   *
   * @param {string} sn - 设备编号
   * @param {string} pkey - 设备 KEY（设备底部标签）
   * @param {string} name - 设备名称
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async addPrinter(sn, pkey, name) {
    if (!sn || !pkey) {
      return { success: false, message: '设备编号和 KEY 不能为空' };
    }

    const params = buildSignedParams({
      appid: config.printer.appId,
      timestamp: Math.floor(Date.now() / 1000),
      business: '1',
      sn: sn,
      pkey: pkey,
      name: name || '披萨店打印机',
    });

    // 重新计算签名（不含 sign 自身）
    const appSecret = config.printer.appSecret;
    const ts = params.timestamp;
    const signParams = { appid: params.appid, timestamp: ts, business: '1', sn, pkey, name: name || '披萨店打印机' };
    params.sign = buildSign(signParams, appSecret);

    log.info({ sn, name }, '添加设备');

    try {
      const result = await apiRequest('/v1/printer/add', params);
      log.info({ result }, '添加设备响应');

      if (result.errorcode === 0) {
        return { success: true, message: '设备添加成功' };
      }
      if (result.errorcode === 5) {
        return { success: true, message: '设备已存在，无需重复添加' };
      }
      return { success: false, message: result.errormsg || `添加失败 (errorcode: ${result.errorcode})` };
    } catch (err) {
      log.error({ err }, '添加设备异常');
      return { success: false, message: err.message };
    }
  },

  /**
   * 提交订单小票打印。
   *
   * @param {object} order — 完整订单（需含 items 数组）
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async printOrderTicket(order) {
    if (!config.printer.enabled) {
      return { success: false, message: '打印机未启用' };
    }
    if (!config.printer.sn) {
      log.warn('未配置打印机 SN，跳过打印');
      return { success: false, message: '未配置打印机 SN' };
    }

    const content = buildOrderContent(order);
    const contentBytes = Buffer.byteLength(content, 'utf8');

    if (contentBytes > 5000) {
      log.warn({ contentBytes }, '打印内容过大，将截断');
    }

    const appSecret = config.printer.appSecret;
    const timestamp = Math.floor(Date.now() / 1000);

    const signParams = {
      appid: config.printer.appId,
      timestamp,
      content,
      sn: config.printer.sn,
      times: String(config.printer.copies || 1),
    };
    const sign = buildSign(signParams, appSecret);

    const params = {
      ...signParams,
      sign,
    };

    log.info({ orderId: order.id, sn: config.printer.sn, size: contentBytes }, '打印订单');

    try {
      const result = await apiRequest('/v1/printer/print', params);

      if (result.errorcode === 0) {
        log.info({ orderId: order.id, jobId: result.id }, '打印成功');
        return { success: true, message: '打印成功', jobId: result.id };
      }
      log.warn({ errorcode: result.errorcode, errormsg: result.errormsg }, '打印失败');
      return { success: false, message: result.errormsg || '打印失败' };
    } catch (err) {
      log.error({ err }, '打印请求异常');
      return { success: false, message: err.message };
    }
  },

  /**
   * 测试打印一张测试小票。
   */
  async testPrint() {
    if (!config.printer.enabled) {
      return { success: false, message: '打印机未启用' };
    }
    if (!config.printer.sn) {
      return { success: false, message: '未配置打印机 SN' };
    }

    const now = new Date();
    const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    const storeName = config.printer.storeName || '王姐手工披萨';
    const audioEnabled = config.printer.audioEnabled !== false;

    const lines = [
      `<C><B><L1>${storeName}</L1></B></C>`,
      '<C>——————————————</C>',
      '<C><L2>打印机测试</L2></C>',
      `<BR>`,
      `测试时间：${timeStr}<BR>`,
      `打印机 SN：${config.printer.sn}<BR>`,
      `<BR>`,
      '<C>——————————————</C>',
      '<C>打印机配置正确！</C>',
      `<C>${config.printer.footerText || '感谢您的光临！'}</C>`,
    ];
    if (audioEnabled) {
      lines.push('<AUDIO-COMMON>');
    }

    const content = lines.join('');
    const appSecret = config.printer.appSecret;
    const timestamp = Math.floor(Date.now() / 1000);

    const signParams = {
      appid: config.printer.appId,
      timestamp,
      content,
      sn: config.printer.sn,
      times: '1',
    };
    const sign = buildSign(signParams, appSecret);

    const params = { ...signParams, sign };

    log.info({ sn: config.printer.sn }, '测试打印');

    try {
      const result = await apiRequest('/v1/printer/print', params);
      log.info({ result }, '测试打印响应');

      if (result.errorcode === 0) {
        return { success: true, message: '测试打印已发送' };
      }
      const msg = result.errormsg || `打印失败 (errorcode: ${result.errorcode})`;
      log.error({ detail: msg }, '测试打印失败');
      return { success: false, message: msg };
    } catch (err) {
      log.error({ err }, '测试打印异常');
      return { success: false, message: err.message };
    }
  },

  /**
   * 生成打印内容预览（使用当前配置，不实际打印）。
   */
  previewContent() {
    const now = new Date();
    const ts = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    const storeName = config.printer.storeName || '王姐手工披萨';
    const footerText = config.printer.footerText || '感谢您的光临！';
    const footerTip = config.printer.footerTip || '请到取餐口出示取餐码';
    const audioEnabled = config.printer.audioEnabled !== false;

    const lines = [
      `<C><B><L1>${storeName}</L1></B></C>`,
      '<C>——————————————</C>',
      '<C>取餐码</C>',
      '<C><L2>A001</L2></C>',
      '<C>——————————————</C>',
      '<BR>',
      '订单号：20260617001<BR>',
      '下单时间：' + ts + '<BR>',
      '支付方式：微信支付<BR>',
      '备注：少辣<BR>',
      '<BR>',
      '——————————————<BR>',
      '<B>商品名称        数量  金额</B><BR>',
      '——————————————<BR>',
      '夏威夷披萨        x1  ￥58.00<BR>',
      '  └ 忌口: 不吃辣, 花生过敏<BR>',
      '榴莲饼            x2  ￥56.00<BR>',
      '  └ 忌口: 素食<BR>',
      '——————————————<BR>',
      '商品合计：￥114.00<BR>',
      '优惠减免：-￥24.00<BR>',
      '<B><L1>实付：￥90.00</L1></B><BR>',
      '<BR>',
      '<C>——————————————</C>',
      `<C>${footerText}</C>`,
      `<C>${footerTip}</C>`,
      '<BR>',
    ];

    if (audioEnabled) {
      lines.push('<AUDIO-COMMON>');
    }

    const raw = lines.join('');

    // 移除标签，生成纯文本预览
    const plain = raw
      .replace(/<AUDIO-COMMON>/g, '')
      .replace(/<BR>/g, '\n')
      .replace(/<[^>]+>/g, '');

    return { raw, plain };
  },
};

module.exports = printerService;
