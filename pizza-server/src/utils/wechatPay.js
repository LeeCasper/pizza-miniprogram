/**
 * WeChat Pay API v3 — Crypto Utilities
 *
 * Implements:
 *   - Request signing (SHA256-RSA2048 Authorization header)
 *   - Callback notification signature verification
 *   - Callback notification decryption (AES-256-GCM)
 *   - Prepay params builder for wx.requestPayment()
 *
 * References:
 *   https://pay.weixin.qq.com/doc/v3/merchant/4012791860
 *   https://pay.weixin.qq.com/doc/v3/merchant/4012791894
 *   https://pay.weixin.qq.com/doc/v3/merchant/4012791856
 */

const crypto = require('crypto');
const fs = require('fs');
const config = require('../config');

// ── Helpers ──────────────────────────────────────────────────────────

/** RFC 3339 timestamp with milliseconds */
function rfc3339() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.` +
    `${String(d.getMilliseconds()).padStart(3, '0')}+08:00`;
}

/** Random 32-char nonce */
function nonceStr() {
  return crypto.randomBytes(16).toString('hex').toUpperCase();
}

/** Load PEM file and return key content */
function loadPem(path) {
  if (!path) return null;
  try {
    return fs.readFileSync(path, 'utf8');
  } catch (_) {
    console.error('[wechatPay] Failed to load PEM:', path);
    return null;
  }
}

// ── Lazy-loaded keys ─────────────────────────────────────────────────
// Priority: DB content (_privateKeyContent / _platformCertContent) > disk file > null

function getMerchantPrivateKey() {
  // Check DB-backed content first (set by systemConfigService.syncPayConfigToMemory)
  if (config.wxPay._privateKeyContent) {
    return config.wxPay._privateKeyContent;
  }
  // Fallback to disk file
  if (!_merchantPrivateKeyCached) {
    _merchantPrivateKeyCached = loadPem(config.wxPay.privateKeyPath);
  }
  return _merchantPrivateKeyCached;
}

function getPlatformCert() {
  if (config.wxPay._platformCertContent) {
    return config.wxPay._platformCertContent;
  }
  if (!_platformCertCached) {
    _platformCertCached = loadPem(config.wxPay.platformCertPath);
  }
  return _platformCertCached;
}

let _merchantPrivateKeyCached = undefined;
let _platformCertCached = undefined;

// ── 1. Request Signing ───────────────────────────────────────────────

/**
 * Sign a WeChat Pay v3 API request.
 *
 * @param {string} method  - HTTP method (GET, POST, etc.)
 * @param {string} url     - Full URL including path (e.g. /v3/pay/transactions/jsapi)
 * @param {string} body    - Request body string (empty for GET)
 * @returns {{ Authorization: string }} header object
 */
function sign(method, url, body) {
  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = nonceStr();
  const bodyStr = body || '';

  // Build the signing message
  const message = [method.toUpperCase(), url, String(timestamp), nonce, bodyStr, ''].join('\n');

  const privateKey = getMerchantPrivateKey();
  if (!privateKey) {
    throw new Error('Merchant private key not loaded. Check WX_PAY_PRIVATE_KEY_PATH.');
  }

  const sign = crypto.createSign('RSA-SHA256');
  sign.update(message);
  sign.end();
  const signature = sign.sign(privateKey, 'base64');

  const authorization =
    `WECHATPAY2-SHA256-RSA2048 ` +
    `mchid="${config.wxPay.mchId}",` +
    `nonce_str="${nonce}",` +
    `timestamp="${timestamp}",` +
    `serial_no="${config.wxPay.certSerialNo}",` +
    `signature="${signature}"`;

  return { Authorization: authorization };
}

// ── 2. Callback Signature Verification ────────────────────────────────

/**
 * Verify the signature on a WeChat Pay callback notification.
 *
 * @param {object} headers - HTTP headers object (lowercase keys)
 * @param {string} body    - Raw request body string
 * @returns {boolean}
 */
function verifyNotifySign(headers, body) {
  try {
    const timestamp = headers['wechatpay-timestamp'];
    const nonce   = headers['wechatpay-nonce'];
    const signature = headers['wechatpay-signature'];
    const serialNo  = headers['wechatpay-serial'];

    if (!timestamp || !nonce || !signature) {
      console.error('[wechatPay] Missing notify signature headers');
      return false;
    }

    // Build the verification message (same format as request signing)
    const message = [timestamp, nonce, body, ''].join('\n');

    // Load WeChat platform certificate (DB-backed or file)
    const platformCert = getPlatformCert();
    if (!platformCert) {
      console.error('[wechatPay] Platform certificate not found.');
      return false;
    }

    const verify = crypto.createVerify('RSA-SHA256');
    verify.update(message);
    verify.end();
    return verify.verify(platformCert, signature, 'base64');
  } catch (err) {
    console.error('[wechatPay] Notify sign verify error:', err.message);
    return false;
  }
}

// ── 3. Callback Decryption (AES-256-GCM) ──────────────────────────────

/**
 * Decrypt WeChat Pay callback notification body.
 *
 * The notification's resource field contains:
 *   - ciphertext:  Base64-encoded AES-256-GCM ciphertext
 *   - associated_data: Additional authenticated data
 *   - nonce:       12-byte nonce (Base64)
 *
 * @param {string} ciphertext     - Base64-encoded ciphertext
 * @param {string} associatedData - Associated data string
 * @param {string} nonceStr       - Base64-encoded nonce
 * @returns {object} decrypted JSON object
 */
function decryptNotify(ciphertext, associatedData, nonceStr) {
  const key = config.wxPay.apiV3Key;
  if (!key || key.length !== 32) {
    throw new Error('WX_PAY_API_V3_KEY must be a 32-character string');
  }

  const ciphertextBuf = Buffer.from(ciphertext, 'base64');
  const authTag = ciphertextBuf.subarray(ciphertextBuf.length - 16);
  const encryptedData = ciphertextBuf.subarray(0, ciphertextBuf.length - 16);
  const nonce = Buffer.from(nonceStr, 'base64');
  const aad = Buffer.from(associatedData || '', 'utf8');

  // AES-256-GCM decrypt
  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(key, 'utf8'), nonce, {
    authTagLength: 16,
  });
  decipher.setAAD(aad);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedData, undefined, 'utf8');
  decrypted += decipher.final('utf8');

  return JSON.parse(decrypted);
}

// ── 4. Build wx.requestPayment() params ───────────────────────────────

/**
 * Build the parameters for wx.requestPayment() in the mini program.
 *
 * @param {string} prepayId - prepay_id from WeChat Pay JSAPI order response
 * @returns {{ timeStamp, nonceStr, package, signType, paySign }}
 */
function buildPayParams(prepayId) {
  const ts = String(Math.floor(Date.now() / 1000));
  const nonce = nonceStr();
  const pkg = `prepay_id=${prepayId}`;

  // Signing message: appId\n + timestamp\n + nonceStr\n + package\n
  const message = [config.wx.appId, ts, nonce, pkg, ''].join('\n');

  const privateKey = getMerchantPrivateKey();
  if (!privateKey) {
    throw new Error('Merchant private key not loaded. Check WX_PAY_PRIVATE_KEY_PATH.');
  }

  const sign = crypto.createSign('RSA-SHA256');
  sign.update(message);
  sign.end();
  const paySign = sign.sign(privateKey, 'base64');

  return {
    timeStamp: ts,
    nonceStr: nonce,
    package: pkg,
    signType: 'RSA',
    paySign,
  };
}

// ── 5. Generate out_trade_no ──────────────────────────────────────────

/**
 * Generate a unique out_trade_no for WeChat Pay.
 * For orders: use the order ID directly.
 * For recharge: use "RCH" + YYYYMMDDHHmmss + 6 random digits.
 *
 * @param {string} type - 'order' | 'recharge'
 * @param {string} [orderId] - order ID (when type='order')
 * @returns {string}
 */
function generateOutTradeNo(type, orderId) {
  if (type === 'order' && orderId) {
    return orderId;
  }
  // recharge
  const d = new Date();
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  const datePart = `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const rand = String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
  return `RCH${datePart}${rand}`;
}

// ── 6. HTTP client for WeChat Pay API ─────────────────────────────────

const WXPAY_BASE = 'https://api.mch.weixin.qq.com';

/**
 * Make an authenticated request to WeChat Pay API v3.
 *
 * @param {string} method - HTTP method
 * @param {string} path   - API path (e.g. /v3/pay/transactions/jsapi)
 * @param {object} [data] - Request body (for POST)
 * @returns {Promise<object>} parsed JSON response
 */
async function payRequest(method, path, data) {
  const body = data ? JSON.stringify(data) : '';
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': 'PizzaShop/1.0',
    ...sign(method, path, body),
  };

  const url = WXPAY_BASE + path;

  return new Promise((resolve, reject) => {
    const http = require(url.startsWith('https') ? 'https' : 'http');
    const parsed = new URL(url);

    const options = {
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: parsed.pathname + (parsed.search || ''),
      method,
      headers,
    };

    const req = http.request(options, (res) => {
      let respBody = '';
      res.on('data', (chunk) => { respBody += chunk; });
      res.on('end', () => {
        try {
          const result = JSON.parse(respBody);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(result);
          } else {
            const err = new Error(result.message || `WeChat Pay API error ${res.statusCode}`);
            err.statusCode = res.statusCode;
            err.wechatError = result;
            reject(err);
          }
        } catch (parseErr) {
          reject(new Error(`Failed to parse WeChat Pay response: ${respBody}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('WeChat Pay request timeout')); });

    if (body) {
      req.write(body);
    }
    req.end();
  });
}

module.exports = {
  sign,
  verifyNotifySign,
  decryptNotify,
  buildPayParams,
  generateOutTradeNo,
  payRequest,
  WXPAY_BASE,
};
