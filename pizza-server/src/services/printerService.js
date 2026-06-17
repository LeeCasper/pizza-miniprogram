/**
 * Printer Service — 商鹏云打印机
 *
 * 订单创建后自动打印小票 + 语音播报。
 * 商鹏云打印 API 通过 appId + appSecret 鉴权。
 *
 * API 端点（行业标准）:
 *   POST   /v1/print              — 提交打印任务
 *   GET    /printer/{sn}          — 查询打印机状态
 *   DELETE /printer/{sn}/queue    — 清空打印队列
 */

const https = require('https');
const http = require('http');
const config = require('../config');

// ── Token 生成 ─────────────────────────────────────────

let _cachedToken = null;
let _tokenExpiresAt = 0;

/**
 * 获取 API 访问 token。
 * 实际对接时根据商鹏开放平台的鉴权方式调整。
 * 常见方式: POST /v1/auth/token { appId, appSecret } → { token, expiresIn }
 */
async function getToken() {
  if (_cachedToken && Date.now() < _tokenExpiresAt - 60000) {
    return _cachedToken;
  }

  // 如果没有 appId/appSecret，跳过鉴权（某些平台直接传 appId+signature）
  if (!config.printer.appId || !config.printer.appSecret) {
    return null;
  }

  const body = JSON.stringify({
    appId: config.printer.appId,
    appSecret: config.printer.appSecret,
  });

  try {
    const result = await apiRequest('POST', '/v1/auth/token', body);
    if (result && result.token) {
      _cachedToken = result.token;
      _tokenExpiresAt = Date.now() + (result.expiresIn || 7200) * 1000;
      return _cachedToken;
    }
  } catch (err) {
    console.error('[Printer] Failed to get token:', err.message);
  }
  return null;
}

// ── HTTP 请求封装 ──────────────────────────────────────

function apiRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, config.printer.apiBase);
    const isHttps = url.protocol === 'https:';
    const httpModule = isHttps ? https : http;

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers,
      timeout: 15000,
    };

    const req = httpModule.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (_) {
          resolve({ raw: data });
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Printer API request timeout'));
    });

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

// ── 打印内容构建 ────────────────────────────────────────

/**
 * 根据订单数据构建商鹏 JSON 小票内容。
 *
 * @param {object} order — 完整订单对象（含 items 数组）
 * @returns {object} 打印 content
 */
function buildOrderContent(order) {
  const now = new Date();
  const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const storeName = order.storeName || order.store_name || '王姐手工披萨';
  const paymentMethod = order.paymentMethod || order.payment_method || '';
  const payLabel = paymentMethod === 'balance' ? '余额支付' : paymentMethod === 'wechat' ? '微信支付' : '待支付';

  const contents = [
    // 标题
    { cont: '🔔 新订单', type: 'title', size: '14', align: 'center', bold: true },
    { cont: storeName, align: 'center', size: '10', bold: true },
    { cont: '--------------------------------', align: 'center', size: '8' },

    // 订单信息
    { cont: `订单号：${order.id}`, align: 'left', size: '9' },
    { cont: `取餐码：${order.pickupCode || order.pickup_code || '—'}`, align: 'left', size: '12', bold: true },
    { cont: `下单时间：${timeStr}`, align: 'left', size: '8' },
    { cont: `支付方式：${payLabel}`, align: 'left', size: '8' },
  ];

  // 备注
  if (order.note) {
    contents.push({ cont: `备注：${order.note}`, align: 'left', size: '8' });
  }

  contents.push({ cont: '--------------------------------', align: 'center', size: '8' });

  // 商品表格
  const items = order.items || [];
  if (items.length > 0) {
    contents.push({
      thead: { '商品': '50%', '数量': '20%', '金额': '30%' },
      tbody: items.map(item => [
        item.productName || item.product_name || item.name || '—',
        String(item.quantity || 1),
        `¥${parseFloat(item.price * (item.quantity || 1)).toFixed(2)}`,
      ]),
      size: '9',
    });
  }

  contents.push({ cont: '--------------------------------', align: 'center', size: '8' });

  // 金额汇总
  const total = parseFloat(order.total || 0).toFixed(2);
  const discount = parseFloat(order.discountAmount || order.discount_amount || 0).toFixed(2);
  const paid = parseFloat(order.paidAmount || order.paid_amount || total).toFixed(2);

  contents.push({ cont: `商品合计：¥${total}`, align: 'right', size: '9' });
  if (parseFloat(discount) > 0) {
    contents.push({ cont: `优惠减免：-¥${discount}`, align: 'right', size: '9' });
  }
  contents.push({ cont: `实付金额：¥${paid}`, align: 'right', size: '11', bold: true });

  // 页脚
  contents.push({ cont: '--------------------------------', align: 'center', size: '8' });
  contents.push({ cont: '感谢您的光临！', align: 'center', size: '8' });
  contents.push({ cont: `取餐码 ${order.pickupCode || order.pickup_code || '—'} 请在取餐口出示`, align: 'center', size: '8' });

  return {
    pWidth: '58',
    pCopy: config.printer.copies || 1,
    contents,
  };
}

/**
 * 构建语音播报文字。
 *
 * @param {object} order
 * @returns {string}
 */
function buildVoiceContent(order) {
  const storeName = order.storeName || order.store_name || '王姐手工披萨';
  const code = order.pickupCode || order.pickup_code || '';
  const paymentMethod = order.paymentMethod || order.payment_method || '';
  const payLabel = paymentMethod === 'balance' ? '余额支付' : '新的';

  const parts = [];
  parts.push(`您有${payLabel}订单`);
  if (code) {
    parts.push(`取餐码${code.split('').join(' ')}`);
  }
  parts.push(`请及时处理`);

  return parts.join('，');
}

// ── 公共接口 ────────────────────────────────────────────

const printerService = {

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
    const voice = buildVoiceContent(order);

    const printData = {
      sn: config.printer.sn,
      content: content,
    };

    // 如果支持语音播报，附上 voice 字段
    if (voice) {
      printData.voice = voice;
    }

    console.log(`[Printer] 打印订单: ${order.id}, voice: ${voice}`);

    try {
      const token = await getToken();
      if (token) {
        printData.token = token;
      }

      const result = await apiRequest('POST', '/v1/print', printData);

      if (result.code === 0) {
        console.log(`[Printer] 打印成功: 订单 ${order.id}`);
        return { success: true, message: '打印成功' };
      } else if (result.code === 202) {
        console.log(`[Printer] 打印机离线，已加入排队: 订单 ${order.id}`);
        return { success: true, message: '打印机离线，已加入打印队列' };
      } else {
        console.warn(`[Printer] 打印返回异常: ${JSON.stringify(result)}`);
        return { success: false, message: result.message || '打印失败' };
      }
    } catch (err) {
      console.error(`[Printer] 打印请求失败: ${err.message}`);
      return { success: false, message: err.message };
    }
  },

  /**
   * 测试打印一张测试小票。
   *
   * @returns {Promise<{success: boolean, message: string}>}
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

    const testContent = {
      pWidth: '58',
      pCopy: 1,
      contents: [
        { cont: '王姐手工披萨', type: 'title', size: '12', align: 'center', bold: true },
        { cont: '--------------------------------', align: 'center', size: '8' },
        { cont: '🧪 打印机测试', align: 'center', size: '11', bold: true },
        { cont: `测试时间：${timeStr}`, align: 'left', size: '9' },
        { cont: `打印机 SN：${config.printer.sn}`, align: 'left', size: '8' },
        { cont: '--------------------------------', align: 'center', size: '8' },
        { cont: '如果您看到这张小票，说明打印机配置正确！', align: 'center', size: '8' },
        { cont: '--------------------------------', align: 'center', size: '8' },
        { cont: '1', type: 'cut' },
      ],
    };

    const printData = {
      sn: config.printer.sn,
      content: testContent,
    };

    try {
      const token = await getToken();
      if (token) {
        printData.token = token;
      }

      const result = await apiRequest('POST', '/v1/print', printData);

      if (result.code === 0) {
        return { success: true, message: '测试打印已发送' };
      } else if (result.code === 202) {
        return { success: true, message: '打印机离线，已加入打印队列' };
      } else {
        return { success: false, message: result.message || '打印失败' };
      }
    } catch (err) {
      return { success: false, message: err.message };
    }
  },

  /**
   * 查询打印机在线状态。
   *
   * @returns {Promise<{online: boolean, status: number}>}
   */
  async getPrinterStatus() {
    if (!config.printer.sn) {
      return { online: false, status: -1, message: '未配置 SN' };
    }

    try {
      const token = await getToken();
      const path = `/printer/${config.printer.sn}`;
      const result = await apiRequest('GET', path);

      // API 返回 { sn, name, online, status, queue }
      return {
        online: result.online === true,
        status: result.status || 0,
        name: result.name || '',
        queue: result.queue || 0,
      };
    } catch (err) {
      console.error('[Printer] 查询状态失败:', err.message);
      return { online: false, status: -1, message: err.message };
    }
  },

  /**
   * 清空打印机任务队列。
   *
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async clearPrintQueue() {
    if (!config.printer.sn) {
      return { success: false, message: '未配置 SN' };
    }

    try {
      const token = await getToken();
      const path = `/printer/${config.printer.sn}/queue`;
      const result = await apiRequest('DELETE', path);
      return { success: result.code === 0, message: '队列已清空' };
    } catch (err) {
      return { success: false, message: err.message };
    }
  },
};

module.exports = printerService;
