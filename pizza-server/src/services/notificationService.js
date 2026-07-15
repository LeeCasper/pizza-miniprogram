/**
 * 订阅消息通知服务
 *
 * WeChat API: POST /cgi-bin/message/subscribe/send
 * https://developers.weixin.qq.com/miniprogram/dev/OpenApiDoc/mp-message-management/subscribe-message/sendMessage.html
 *
 * 字段映射由管理员在后台配置（每行：字段名=数据来源）。
 * 数据来源与中文标签的对应关系见 SOURCE_LABEL_MAP。
 */

const axios = require('axios');
const pool = require('../config/database');
const { getAccessToken } = require('../utils/wechat');
const { createLogger } = require('../utils/logger');
const log = createLogger('Notification');

// 数据来源 → 中文标签（供管理员参考）
const SOURCE_LABELS = {
  orderId: ['订单编号', '订单号', '订单ID'],
  status: ['订单状态', '状态', '进度'],
  storeName: ['门店名称', '门店', '店铺', '商家', '餐厅'],
  pickupCode: ['取餐码', '取货码', '提货码'],
  pickupTime: ['预约时间', '取餐时间', '预约取餐'],
  paidAmount: ['支付金额', '付款金额', '实付金额', '金额'],
  couponName: ['券名称', '优惠券名称', '券类型'],
  validTo: ['有效期', '到期时间', '截止日期'],
  tip: ['提示', '备注', '说明'],
};

/** 解析管理员配置的字段映射："thing1=订单编号\nphrase2=订单状态" → { thing1:'orderId', phrase2:'status' } */
function _parseFieldMapping(raw) {
  if (!raw || !raw.trim()) return null;
  const map = {};
  const lines = raw.trim().split(/[\n\r]+/);
  for (const line of lines) {
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const fieldName = line.substring(0, idx).trim();
    const label = line.substring(idx + 1).trim();
    if (!fieldName || !label) continue;
    // 根据中文标签匹配数据来源
    for (const [src, labels] of Object.entries(SOURCE_LABELS)) {
      if (labels.some(l => label === l || label.includes(l) || l.includes(label))) {
        map[fieldName] = src;
        break;
      }
    }
  }
  return Object.keys(map).length > 0 ? map : null;
}

/** 读取 miniprogram_state */
async function _getState() {
  try {
    const [[r]] = await pool.query("SELECT config_value FROM system_config WHERE config_key='notify_miniprogram_state'");
    if (r && r.config_value) return r.config_value;
  } catch (_) {}
  return process.env.NODE_ENV === 'production' ? 'formal' : 'developer';
}

const notificationService = {

  async getConfig() {
    const [rows] = await pool.query(
      "SELECT config_key, config_value FROM system_config WHERE config_key IN ('notify_order_tpl','notify_coupon_tpl','notify_order_fields','notify_coupon_fields')"
    );
    const m = {};
    for (const r of rows) m[r.config_key] = r.config_value || '';
    return {
      orderTpl: m.notify_order_tpl || '',
      couponTpl: m.notify_coupon_tpl || '',
      orderFields: m.notify_order_fields || '',
      couponFields: m.notify_coupon_fields || '',
    };
  },

  async updateConfig(data) {
    const keys = ['notify_order_tpl','notify_coupon_tpl','notify_order_fields','notify_coupon_fields'];
    const vals = [data.orderTpl, data.couponTpl, data.orderFields, data.couponFields];
    for (let i = 0; i < keys.length; i++) {
      if (vals[i] !== undefined) {
        await pool.query(
          'INSERT INTO system_config (config_key, config_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE config_value = ?',
          [keys[i], vals[i] || '', vals[i] || '']
        );
      }
    }
    return this.getConfig();
  },

  // ── 发送（严格按微信官方文档） ──────────────

  async send(openid, type, valueMap, page) {
    try {
      // 读配置
      const tplKey = type === 'order' ? 'notify_order_tpl' : 'notify_coupon_tpl';
      const fieldsKey = type === 'order' ? 'notify_order_fields' : 'notify_coupon_fields';
      const [[tplRow]] = await pool.query('SELECT config_value FROM system_config WHERE config_key=?', [tplKey]);
      const templateId = tplRow ? tplRow.config_value || '' : '';
      if (!templateId) return { sent: false, reason: 'no_template_id' };
      if (!openid) return { sent: false, reason: 'no_openid' };

      // 解析字段映射
      const [[fieldsRow]] = await pool.query('SELECT config_value FROM system_config WHERE config_key=?', [fieldsKey]);
      const fieldMap = _parseFieldMapping(fieldsRow ? fieldsRow.config_value : '');

      // 构建 data
      const data = {};
      if (fieldMap) {
        // 使用管理员配置的精确字段映射
        for (const [fieldName, src] of Object.entries(fieldMap)) {
          const val = valueMap[src] || '';
          data[fieldName] = { value: String(val).slice(0, 32) };
        }
      } else {
        // 未配置字段映射 → 发送所有非空值到常用字段名（可能不匹配，需要管理员配置）
        log.warn({ type }, 'No field mapping configured — sending to fallback fields');
        if (valueMap.orderId) data.thing1 = { value: String(valueMap.orderId).slice(0, 20) };
        if (valueMap.status) data.thing2 = { value: String(valueMap.status).slice(0, 20) };
        if (valueMap.storeName) data.thing3 = { value: String(valueMap.storeName).slice(0, 20) };
        if (valueMap.pickupCode) data.thing4 = { value: String(valueMap.pickupCode).slice(0, 32) };
        if (valueMap.couponName) data.thing1 = { value: String(valueMap.couponName).slice(0, 20) };
        if (valueMap.validTo) data.time2 = { value: String(valueMap.validTo).slice(0, 20) };
        if (valueMap.tip) data.thing3 = { value: String(valueMap.tip).slice(0, 20) };
      }

      const state = await _getState();
      const token = await getAccessToken();
      const body = { touser: openid, template_id: templateId, page: page || '', data, miniprogram_state: state };
      const url = `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${token}`;

      const { data: resp } = await axios.post(url, body, { headers: { 'Content-Type': 'application/json' }, timeout: 8000 });

      if (resp.errcode === 0) {
        log.info({ openid, type }, 'Sent');
        return { sent: true };
      }
      log.warn({ errcode: resp.errcode, errmsg: resp.errmsg, type }, 'Send failed');
      return { sent: false, errcode: resp.errcode, errmsg: resp.errmsg };
    } catch (err) {
      log.error({ err: err.message, type }, 'Exception');
      return { sent: false, reason: 'exception' };
    }
  },

  async notifyOrderStatus(order) {
    try {
      const [[u]] = await pool.query('SELECT openid FROM users WHERE id=?', [order.user_id]);
      if (!u || !u.openid) return { sent: false, reason: 'no_openid' };
      const st = { waiting:'待取餐', preparing:'制作中', completed:'已完成', cancelled:'已取消' };
      return this.send(u.openid, 'order', {
        orderId: String(order.id||'').slice(-8),
        status: st[order.status]||order.status,
        storeName: order.store_name||'王姐手工披萨',
        pickupCode: order.pickup_code ? String(order.pickup_code) : '',
        pickupTime: order.pickup_time ? String(order.pickup_time).slice(0,16) : '',
        paidAmount: order.paid_amount ? parseFloat(order.paid_amount).toFixed(2) : '',
      }, '/pages/main/main');
    } catch (err) { log.error({err},'notifyOrderStatus'); return {sent:false}; }
  },

  async notifyCouponReceived(userId, couponName, validTo) {
    try {
      const [[u]] = await pool.query('SELECT openid FROM users WHERE id=?', [userId]);
      if (!u || !u.openid) return { sent: false };
      return this.send(u.openid, 'coupon', {
        couponName: (couponName||'').slice(0,20),
        validTo: validTo||'',
        tip: '已放入"我的-兑换券"',
      }, '/pages/coupons/coupons');
    } catch (err) { log.error({err},'notifyCouponReceived'); return {sent:false}; }
  },
};

module.exports = notificationService;
