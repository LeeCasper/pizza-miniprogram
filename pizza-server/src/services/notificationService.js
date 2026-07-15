/**
 * 订阅消息通知服务
 *
 * 微信小程序订阅消息（Subscribe Message）：
 * 1. 用户在小程序端通过 wx.requestSubscribeMessage() 授权
 * 2. 服务端调用 subscribeMessage.send 发送（每次授权仅可发送一条消息）
 * 3. 模板 ID 通过管理后台配置（system_config 存储）
 *
 * Reference: https://developers.weixin.qq.com/miniprogram/dev/OpenApiDoc/mp-message-management/subscribe-message/sendMessage.html
 */

const axios = require('axios');
const pool = require('../config/database');
const { getAccessToken } = require('../utils/wechat');
const { createLogger } = require('../utils/logger');

const log = createLogger('Notification');

// system_config keys
const TPL_KEYS = {
  order: 'notify_order_tpl',
  coupon: 'notify_coupon_tpl',
};

const ENABLED_KEYS = {
  order: 'notify_order_enabled',
  coupon: 'notify_coupon_enabled',
};

const STATE_KEY = 'notify_miniprogram_state';

/** 读取 miniprogram_state 配置，未设置时自动推断 */
async function _getMiniprogramState() {
  try {
    const [[row]] = await pool.query(
      'SELECT config_value FROM system_config WHERE config_key = ?', [STATE_KEY]
    );
    if (row && row.config_value) return row.config_value;
  } catch (_) {}
  return process.env.NODE_ENV === 'production' ? 'formal' : 'developer';
}

const notificationService = {

  // ── 配置读取 ─────────────────────────────────

  /** 获取所有通知配置（管理员用） */
  async getConfig() {
    const keys = [...Object.values(TPL_KEYS), ...Object.values(ENABLED_KEYS)];
    const [rows] = await pool.query(
      'SELECT config_key, config_value FROM system_config WHERE config_key IN (?, ?, ?, ?)',
      keys
    );
    const map = {};
    for (const r of rows) map[r.config_key] = r.config_value || '';
    return {
      orderTpl: map[TPL_KEYS.order] || '',
      couponTpl: map[TPL_KEYS.coupon] || '',
      orderEnabled: map[ENABLED_KEYS.order] !== '0',
      couponEnabled: map[ENABLED_KEYS.coupon] !== '0',
    };
  },

  /** 更新通知配置 */
  async updateConfig(data) {
    const entries = [];
    if (data.orderTpl !== undefined) entries.push([TPL_KEYS.order, data.orderTpl || '']);
    if (data.couponTpl !== undefined) entries.push([TPL_KEYS.coupon, data.couponTpl || '']);
    if (data.orderEnabled !== undefined) entries.push([ENABLED_KEYS.order, data.orderEnabled ? '1' : '0']);
    if (data.couponEnabled !== undefined) entries.push([ENABLED_KEYS.coupon, data.couponEnabled ? '1' : '0']);
    for (const [key, val] of entries) {
      await pool.query(
        'INSERT INTO system_config (config_key, config_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE config_value = ?',
        [key, val, val]
      );
    }
    return this.getConfig();
  },

  /** 检查某个类型是否已启用 */
  async _isEnabled(type) {
    const key = ENABLED_KEYS[type];
    if (!key) return false;
    const [[row]] = await pool.query(
      'SELECT config_value FROM system_config WHERE config_key = ?', [key]
    );
    return row ? row.config_value !== '0' : false; // 默认关闭
  },

  /** 获取模板 ID */
  async _getTemplateId(type) {
    const key = TPL_KEYS[type];
    if (!key) return null;
    const [[row]] = await pool.query(
      'SELECT config_value FROM system_config WHERE config_key = ?', [key]
    );
    return row ? row.config_value || null : null;
  },

  // ── 发送订阅消息 ─────────────────────────────

  /**
   * 发送订阅消息
   * @param {string} openid — 用户 openid
   * @param {'order'|'coupon'} type — 通知类型
   * @param {object} templateData — 模板字段数据 { thing1: {value:'...'}, ... }
   * @param {string} [page] — 点击消息跳转路径
   * @returns {Promise<{sent:boolean, errcode?:number}>}
   */
  async send(openid, type, templateData, page) {
    try {
      // 检查是否启用
      const enabled = await this._isEnabled(type);
      if (!enabled) return { sent: false, reason: 'disabled' };

      // 获取模板 ID
      const templateId = await this._getTemplateId(type);
      if (!templateId) return { sent: false, reason: 'no_template_id' };

      if (!openid) return { sent: false, reason: 'no_openid' };

      const accessToken = await getAccessToken();
      const url = `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${accessToken}`;

      const body = {
        touser: openid,
        template_id: templateId,
        page: page || '',
        data: templateData,
        miniprogram_state: await _getMiniprogramState(),
      };

      const { data } = await axios.post(url, body, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 8000,
      });

      if (data.errcode === 0) {
        log.info({ openid, type }, 'Subscribe message sent');
        return { sent: true };
      }

      // 常见错误码
      // 43101: 用户拒绝/未授权订阅
      // 40001/42001: access_token 无效
      // 40003: openid 无效
      // 20037: 模板参数不合法
      log.warn({ openid, type, errcode: data.errcode, errmsg: data.errmsg }, 'Subscribe message send failed');
      return { sent: false, errcode: data.errcode, errmsg: data.errmsg };
    } catch (err) {
      log.error({ err, openid, type }, 'Subscribe message send error');
      return { sent: false, reason: 'exception' };
    }
  },

  // ── 业务快捷方法 ────────────────────────────

  /**
   * 发送订单状态变更通知
   * @param {object} order — 订单对象 (含 user_id, id, status, pickupCode, storeName)
   */
  async notifyOrderStatus(order) {
    try {
      // 获取用户 openid
      const [[user]] = await pool.query('SELECT openid FROM users WHERE id = ?', [order.user_id]);
      if (!user || !user.openid) return { sent: false, reason: 'no_openid' };

      const statusText = { waiting: '待取餐', preparing: '制作中', completed: '已完成', cancelled: '已取消' };
      const status = statusText[order.status] || order.status;

      const data = {
        thing1: { value: String(order.id).slice(-8) },           // 订单编号（后8位）
        phrase2: { value: status },                                // 订单状态
        thing3: { value: order.store_name || '王姐手工披萨' },    // 取餐门店
      };

      if (order.pickup_code) {
        data.character_string4 = { value: String(order.pickup_code) }; // 取餐码
      }

      return this.send(user.openid, 'order', data, `/pages/main/main`);
    } catch (err) {
      log.error({ err, orderId: order.id }, 'notifyOrderStatus error');
      return { sent: false, reason: 'exception' };
    }
  },

  /**
   * 发送优惠券到账通知
   * @param {number} userId — 用户 ID
   * @param {string} couponName — 券名称
   * @param {string} validTo — 有效期至 (YYYY-MM-DD)
   */
  async notifyCouponReceived(userId, couponName, validTo) {
    try {
      const [[user]] = await pool.query('SELECT openid FROM users WHERE id = ?', [userId]);
      if (!user || !user.openid) return { sent: false, reason: 'no_openid' };

      const data = {
        thing1: { value: couponName.slice(0, 20) },    // 券名称
        time2: { value: validTo || '请查看券详情' },    // 有效期
        thing3: { value: '已放入"我的-兑换券"，请及时使用' }, // 提示
      };

      return this.send(user.openid, 'coupon', data, '/pages/coupons/coupons');
    } catch (err) {
      log.error({ err, userId }, 'notifyCouponReceived error');
      return { sent: false, reason: 'exception' };
    }
  },
};

module.exports = notificationService;
