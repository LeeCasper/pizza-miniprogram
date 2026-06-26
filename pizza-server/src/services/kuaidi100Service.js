/**
 * 快递100 API Client
 *
 * Server-side proxy for the 快递100 real-time tracking query API.
 * Handles MD5 signing, in-memory caching, and error translation.
 *
 * API docs: https://api.kuaidi100.com/document
 */

const crypto = require('crypto');
const { createLogger } = require('../utils/logger');
const log = createLogger('Kuaidi100');

const API_URL = 'https://poll.kuaidi100.com/poll/query.do';

// ── In-memory cache ──────────────────────────────────
// Keyed by "com:num", holds { data, expiresAt }
const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ── Helpers ──────────────────────────────────────────

/**
 * Generate MD5 sign: MD5(param + key + customer), uppercase hex.
 * @param {string} paramJson - JSON.stringify(param)
 * @param {string} key - kuaidi100 API key
 * @param {string} customer - kuaidi100 customer ID
 * @returns {string} 32-char uppercase hex
 */
function generateSign(paramJson, key, customer) {
  return crypto
    .createHash('md5')
    .update(paramJson + key + customer)
    .digest('hex')
    .toUpperCase();
}

/**
 * Build application/x-www-form-urlencoded body for 快递100.
 * 快递100 requires form-urlencoded, NOT JSON.
 */
function buildFormBody(customer, sign, param) {
  const params = new URLSearchParams();
  params.append('customer', customer);
  params.append('sign', sign);
  params.append('param', param);
  return params.toString();
}

// ── Public API ───────────────────────────────────────

/**
 * Query tracking information from 快递100.
 *
 * @param {object} options
 * @param {string} options.com   - Carrier company code (e.g. "shunfeng")
 * @param {string} options.num   - Tracking number
 * @param {string} [options.phone] - Optional receiver/sender phone (required by SF)
 * @param {object} credentials   - { customer: string, key: string, enabled: boolean|string }
 * @param {boolean} [skipCache=false] - If true, bypass cache and fetch fresh data
 * @returns {object} 快递100 response { message, nu, state, status, data[], com, ... }
 */
async function queryTracking(options, credentials, skipCache = false) {
  const { com, num, phone } = options;

  // Guard: service disabled
  const enabled = credentials.enabled !== false && credentials.enabled !== 'false';
  if (!enabled) {
    throw Object.assign(new Error('物流查询服务未启用'), { statusCode: 503 });
  }

  // Guard: missing credentials
  if (!credentials.customer || !credentials.key) {
    throw Object.assign(new Error('物流服务未配置'), { statusCode: 503 });
  }

  // Check cache
  const cacheKey = `${com}:${num}`;
  if (!skipCache) {
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      log.info({ cacheKey }, 'tracking cache hit');
      return cached.data;
    }
  }

  // Build request payload
  const paramObj = { com, num };
  if (phone) paramObj.phone = phone;

  const paramJson = JSON.stringify(paramObj);
  const sign = generateSign(paramJson, credentials.key, credentials.customer);
  const body = buildFormBody(credentials.customer, sign, paramJson);

  log.info({ com, num, hasPhone: !!phone }, 'kuaidi100 query');

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      throw new Error(`快递100 HTTP ${response.status}`);
    }

    const result = await response.json();

    // Cache successful results (even if no tracking data yet)
    if (result.status === '200' || result.returnCode === '200') {
      cache.set(cacheKey, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
    }

    // Clean up old cache entries periodically (opportunistic)
    if (cache.size > 500) {
      const now = Date.now();
      for (const [k, v] of cache) {
        if (v.expiresAt <= now) cache.delete(k);
      }
    }

    return result;
  } catch (err) {
    if (err.statusCode) throw err; // re-throw our own structured errors
    log.error({ err, com, num }, 'kuaidi100 query failed');
    throw Object.assign(new Error('物流查询失败，请稍后重试'), { statusCode: 502 });
  }
}

/**
 * Clear all cached tracking data. Useful for testing or config reload.
 */
function clearCache() {
  cache.clear();
  log.info('kuaidi100 cache cleared');
}

/**
 * Auto-detect carrier company from a tracking number.
 *
 * Uses kuaidi100's query endpoint with com="autonumber" when credentials are available
 * (same MD5-signing as queryTracking). Falls back to public endpoint if no credentials.
 *
 * @param {string} trackingNo
 * @param {string} [customer] - kuaidi100 customer ID
 * @param {string} [key] - kuaidi100 API key
 * @returns {Promise<object>} { com, auto, state } with each item having .name
 */
async function autoDetectCarrier(trackingNo, customer, key) {
  log.info({ trackingNo, hasAuth: !!(customer && key) }, 'kuaidi100 auto-detect carrier');

  try {
    let result;

    if (customer && key) {
      // Authenticated endpoint — same MD5-signing as queryTracking
      const paramJson = JSON.stringify({ com: 'autonumber', num: trackingNo });
      const sign = generateSign(paramJson, key, customer);
      const body = buildFormBody(customer, sign, paramJson);

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const raw = await response.json();
        log.info({ trackingNo, returnCode: raw.returnCode }, 'kuaidi100 auto-detect (auth) response');

        if (raw.returnCode === '200' && raw.data) {
          // Auth API returns data[] with { comCode, name? } per item
          result = {
            com: (raw.data || []).map(item => ({
              comCode: item.comCode,
              name: item.name || item.comCode,
              lengthPre: item.lengthPre,
            })),
            auto: [],
            state: 'ok',
          };
        }
      }
    }

    // Fallback to public endpoint if auth not configured or failed
    if (!result) {
      const body = new URLSearchParams({ text: trackingNo }).toString();

      const response = await fetch('https://www.kuaidi100.com/autonumber/autoComNum', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        throw new Error(`快递100 HTTP ${response.status}`);
      }

      const raw = await response.json();

      // Enrich public API results
      const { getCarrierName } = require('./carrierMap');
      if (Array.isArray(raw.com)) {
        raw.com = raw.com.map(item => ({
          ...item,
          name: getCarrierName(item.comCode) || item.comCode,
        }));
      }
      if (Array.isArray(raw.auto)) {
        raw.auto = raw.auto.map(item => ({
          ...item,
          name: getCarrierName(item.comCode) || item.comCode,
        }));
      }

      result = raw;
    }

    return result;
  } catch (err) {
    log.error({ err, trackingNo }, 'kuaidi100 auto-detect carrier failed');
    throw Object.assign(
      new Error('识别物流公司失败，请手动输入'),
      { statusCode: 502 }
    );
  }
}

module.exports = { queryTracking, clearCache, autoDetectCarrier };
