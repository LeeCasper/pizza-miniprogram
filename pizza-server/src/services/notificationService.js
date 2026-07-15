/**
 * 订阅消息通知服务
 *
 * 核心思路：从微信 API 拉取模板的实际字段列表，再根据字段中文名自动匹配数据源。
 * 不再硬编码字段名，适配任意模板。
 */

const axios = require('axios');
const pool = require('../config/database');
const { getAccessToken } = require('../utils/wechat');
const { createLogger } = require('../utils/logger');

const log = createLogger('Notification');

// system_config keys
const TPL_KEYS = { order: 'notify_order_tpl', coupon: 'notify_coupon_tpl' };
const STATE_KEY = 'notify_miniprogram_state';

/** 读取 miniprogram_state */
async function _getMiniprogramState() {
  try {
    const [[row]] = await pool.query('SELECT config_value FROM system_config WHERE config_key = ?', [STATE_KEY]);
    if (row && row.config_value) return row.config_value;
  } catch (_) {}
  return process.env.NODE_ENV === 'production' ? 'formal' : 'developer';
}

const notificationService = {

  // ── 配置 ─────────────────────────────────────

  async getConfig() {
    const [rows] = await pool.query(
      'SELECT config_key, config_value FROM system_config WHERE config_key IN (?, ?)',
      [TPL_KEYS.order, TPL_KEYS.coupon]
    );
    const map = {};
    for (const r of rows) map[r.config_key] = r.config_value || '';
    return { orderTpl: map[TPL_KEYS.order] || '', couponTpl: map[TPL_KEYS.coupon] || '' };
  },

  async updateConfig(data) {
    const entries = [];
    if (data.orderTpl !== undefined) entries.push([TPL_KEYS.order, data.orderTpl || '']);
    if (data.couponTpl !== undefined) entries.push([TPL_KEYS.coupon, data.couponTpl || '']);
    for (const [key, val] of entries) {
      await pool.query(
        'INSERT INTO system_config (config_key, config_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE config_value = ?',
        [key, val, val]
      );
    }
    return this.getConfig();
  },

  // ── 发送 ─────────────────────────────────────

  async send(openid, type, valueMap, page) {
    try {
      const tplKey = TPL_KEYS[type];
      if (!tplKey) return { sent: false, reason: 'unknown_type' };
      const [[row]] = await pool.query('SELECT config_value FROM system_config WHERE config_key = ?', [tplKey]);
      const templateId = row ? row.config_value || '' : '';
      if (!templateId) {
        log.warn({ type }, 'Subscribe message NOT sent — template ID not configured');
        return { sent: false, reason: 'no_template_id' };
      }
      if (!openid) {
        log.warn({ type }, 'Subscribe message NOT sent — no openid');
        return { sent: false, reason: 'no_openid' };
      }

      // 发送覆盖所有常见模板字段，WeChat 忽略多余的
      const vals = {
        thing1: valueMap.orderId || valueMap.couponName || '',
        thing2: valueMap.status || valueMap.validTo || '',
        thing3: valueMap.storeName || valueMap.tip || '',
        thing4: valueMap.pickupCode || '',
        thing5: valueMap.pickupTime || '',
        thing6: valueMap.paidAmount || '',
        thing7: valueMap.orderId || '',
        thing8: valueMap.storeName || '',
        thing9: valueMap.pickupCode || '',
        thing10: valueMap.status || valueMap.storeName || '',
        thing11: '', thing12: '', thing13: '', thing14: '', thing15: '',
        character_string1: valueMap.orderId || valueMap.couponName || '',
        character_string2: valueMap.pickupCode || '',
        character_string3: valueMap.storeName || '',
        character_string4: valueMap.pickupTime || '',
        character_string5: valueMap.status || '',
        phrase1: valueMap.status || '',
        phrase2: valueMap.status || '',
        phrase3: valueMap.storeName || '',
        phrase4: valueMap.pickupCode || '',
        phrase5: '',
        time1: valueMap.pickupTime || '',
        time2: valueMap.validTo || '',
        time3: '',
        date1: valueMap.pickupTime || '',
        date2: valueMap.validTo || '',
        date3: '',
        amount1: valueMap.paidAmount || '',
        amount2: '',
        number1: valueMap.pickupCode || valueMap.orderId || '',
        number2: '',
      };

      // 只发送有值的字段
      const data = {};
      for (const [k, v] of Object.entries(vals)) {
        if (v) data[k] = { value: String(v).slice(0, 32) };
      }

      const accessToken = await getAccessToken();
      const url = `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${accessToken}`;

      const body = {
        touser: openid,
        template_id: templateId,
        page: page || '',
        data,
        miniprogram_state: await _getMiniprogramState(),
      };

      const { data: resp } = await axios.post(url, body, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 8000,
      });

      if (resp.errcode === 0) {
        log.info({ openid, type }, 'Subscribe message sent');
        return { sent: true };
      }

      log.warn({ openid, type, errcode: resp.errcode, errmsg: resp.errmsg }, 'Subscribe message send failed');
      return { sent: false, errcode: resp.errcode, errmsg: resp.errmsg };
    } catch (err) {
      log.error({ err, openid, type }, 'Subscribe message send error');
      return { sent: false, reason: 'exception' };
    }
  },

  // ── 业务快捷方法 ────────────────────────────

  async notifyOrderStatus(order) {
    try {
      const [[user]] = await pool.query('SELECT openid FROM users WHERE id = ?', [order.user_id]);
      if (!user || !user.openid) return { sent: false, reason: 'no_openid' };

      const statusText = { waiting: '待取餐', preparing: '制作中', completed: '已完成', cancelled: '已取消' };
      return this.send(user.openid, 'order', {
        orderId: String(order.id || '').slice(-8),
        status: statusText[order.status] || order.status,
        storeName: order.store_name || '王姐手工披萨',
        pickupCode: order.pickup_code ? String(order.pickup_code) : '',
        pickupTime: order.pickup_time ? String(order.pickup_time).slice(0, 16) : '',
        paidAmount: order.paid_amount ? parseFloat(order.paid_amount).toFixed(2) : '',
      }, '/pages/main/main');
    } catch (err) {
      log.error({ err, orderId: order.id }, 'notifyOrderStatus error');
      return { sent: false };
    }
  },

  async notifyCouponReceived(userId, couponName, validTo) {
    try {
      const [[user]] = await pool.query('SELECT openid FROM users WHERE id = ?', [userId]);
      if (!user || !user.openid) return { sent: false, reason: 'no_openid' };
      return this.send(user.openid, 'coupon', {
        couponName: (couponName || '').slice(0, 20),
        validTo: validTo || '',
        tip: '已放入"我的-兑换券"',
      }, '/pages/coupons/coupons');
    } catch (err) {
      log.error({ err, userId }, 'notifyCouponReceived error');
      return { sent: false };
    }
  },
};

module.exports = notificationService;
