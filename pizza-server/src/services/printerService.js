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

const https = require('https');
const crypto = require('crypto');
const config = require('../config');

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
function apiRequest(path, bodyParams) {
  return new Promise((resolve, reject) => {
    // 构建 URL-encoded body
    const parts = [];
    for (const [k, v] of Object.entries(bodyParams)) {
      if (v !== null && v !== undefined) {
        parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(String(v)));
      }
    }
    const body = parts.join('&');

    const apiBase = config.printer.apiBase || 'https://open.spyun.net';
    const url = new URL(path, apiBase);
    const isHttps = url.protocol === 'https:';

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body, 'utf8'),
      },
      timeout: 15000,
    };

    const httpModule = isHttps ? https : require('http');
    const req = httpModule.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        console.log(`[Printer] API POST ${path} → HTTP ${res.statusCode}, body: ${data.slice(0, 500)}`);
        try {
          resolve(JSON.parse(data));
        } catch (_) {
          resolve({ raw: data, httpStatus: res.statusCode });
        }
      });
    });

    req.on('error', (err) => {
      console.error(`[Printer] API POST ${path} → error:`, err.message);
      reject(err);
    });
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Printer API request timeout'));
    });

    req.write(body);
    req.end();
  });
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

  const storeName = order.storeName || order.store_name || '王姐手工披萨';
  const paymentMethod = order.paymentMethod || order.payment_method || '';
  const payLabel = paymentMethod === 'balance' ? '余额支付' : paymentMethod === 'wechat' ? '微信支付' : '待支付';
  const pickupCode = order.pickupCode || order.pickup_code || '—';

  const lines = [];

  // 标题
  lines.push(`<C><B><L1>${storeName}</L1></B></C>`);
  lines.push('<C>——————————————</C>');
  lines.push(`<C><L2>取餐码：${pickupCode}</L2></C>`);
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

  // 商品列表
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
    lines.push(`${paddedName} x${qty}  ¥${lineTotal.toFixed(2)}<BR>`);
  }

  lines.push('——————————————<BR>');

  // 金额汇总
  const discount = parseFloat(order.discountAmount || order.discount_amount || 0);
  lines.push(`<R>商品合计：¥${total.toFixed(2)}</R><BR>`);
  if (discount > 0) {
    lines.push(`<R>优惠减免：-¥${discount.toFixed(2)}</R><BR>`);
  }
  const paid = parseFloat(order.paidAmount || order.paid_amount || total);
  lines.push(`<R><B><L1>实付：¥${paid.toFixed(2)}</L1></B></R><BR>`);
  lines.push(`<BR>`);

  // 页脚
  lines.push('<C>——————————————</C>');
  lines.push('<C>感谢您的光临！</C>');
  lines.push(`<C>取餐码 ${pickupCode} 请取餐口出示</C>`);
  lines.push(`<BR>`);

  // 切纸 + 语音播报
  lines.push('<CUT>');
  lines.push('<AUDIO-COMMON>');

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

    console.log(`[Printer] 添加设备: sn=${sn}, name=${name}`);

    try {
      const result = await apiRequest('/v1/printer/add', params);
      console.log(`[Printer] 添加设备响应:`, JSON.stringify(result));

      if (result.errorcode === 0) {
        return { success: true, message: '设备添加成功' };
      }
      if (result.errorcode === 5) {
        return { success: true, message: '设备已存在，无需重复添加' };
      }
      return { success: false, message: result.errormsg || `添加失败 (errorcode: ${result.errorcode})` };
    } catch (err) {
      console.error(`[Printer] 添加设备异常:`, err.message);
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
      console.warn('[Printer] 未配置打印机 SN，跳过打印');
      return { success: false, message: '未配置打印机 SN' };
    }

    const content = buildOrderContent(order);
    const contentBytes = Buffer.byteLength(content, 'utf8');

    if (contentBytes > 5000) {
      console.warn(`[Printer] 打印内容过大: ${contentBytes} 字节，将截断`);
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

    console.log(`[Printer] 打印订单: ${order.id}, sn=${config.printer.sn}, size=${contentBytes}B`);

    try {
      const result = await apiRequest('/v1/printer/print', params);

      if (result.errorcode === 0) {
        console.log(`[Printer] 打印成功: 订单 ${order.id}, jobId=${result.id}`);
        return { success: true, message: '打印成功', jobId: result.id };
      }
      console.warn(`[Printer] 打印失败: errorcode=${result.errorcode}, msg=${result.errormsg}`);
      return { success: false, message: result.errormsg || '打印失败' };
    } catch (err) {
      console.error(`[Printer] 打印请求异常: ${err.message}`);
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

    const lines = [
      '<C><B><L1>王姐手工披萨</L1></B></C>',
      '<C>——————————————</C>',
      '<C><L2>打印机测试</L2></C>',
      `<BR>`,
      `测试时间：${timeStr}<BR>`,
      `打印机 SN：${config.printer.sn}<BR>`,
      `<BR>`,
      '<C>——————————————</C>',
      '<C>打印机配置正确！</C>',
      '<C>感谢您的光临！</C>',
      '<CUT>',
      '<AUDIO-COMMON>',
    ];

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

    console.log(`[Printer] 测试打印: sn=${config.printer.sn}`);

    try {
      const result = await apiRequest('/v1/printer/print', params);
      console.log(`[Printer] 测试打印响应:`, JSON.stringify(result));

      if (result.errorcode === 0) {
        return { success: true, message: '测试打印已发送' };
      }
      const msg = result.errormsg || `打印失败 (errorcode: ${result.errorcode})`;
      console.error(`[Printer] 测试打印失败: ${msg}`);
      return { success: false, message: msg };
    } catch (err) {
      console.error(`[Printer] 测试打印异常:`, err.message);
      return { success: false, message: err.message };
    }
  },
};

module.exports = printerService;
