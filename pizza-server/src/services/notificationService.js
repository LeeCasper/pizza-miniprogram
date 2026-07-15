/**
 * 订阅消息通知服务 v2
 *
 * 1. 通过微信 gettemplate API 拉取模板的实际字段列表
 * 2. 根据字段中文名自动匹配数据源
 * 3. 字段列表缓存在内存中，配置变更时清除
 */

const axios = require('axios');
const pool = require('../config/database');
const { getAccessToken } = require('../utils/wechat');
const { createLogger } = require('../utils/logger');

const log = createLogger('Notification');

const TPL_KEYS = { order: 'notify_order_tpl', coupon: 'notify_coupon_tpl' };
const STATE_KEY = 'notify_miniprogram_state';

// 内存缓存：{ [priTmplId]: [{ name: 'thing1', label: '订单编号' }, ...] }
let _fieldCache = null;
let _cacheExpires = 0;

/** 从 WeChat API 拉取所有模板及其字段 */
async function _fetchTemplateFieldsFromWx() {
  try {
    const token = await getAccessToken();
    const url = `https://api.weixin.qq.com/wxaapi/newtmpl/gettemplate?access_token=${token}`;
    const { data } = await axios.get(url, { timeout: 8000 });
    if (!data || !data.data || !Array.isArray(data.data)) return {};

    const result = {};
    for (const tpl of data.data) {
      if (!tpl.priTmplId || !tpl.keywordEnumValueList) continue;

      // 从 content 字段解析字段名前缀（如 {{thing1.DATA}} → thing1）
      const fieldPrefixes = {};
      if (tpl.content) {
        const matches = tpl.content.matchAll(/\{\{(\w+)\.DATA\}\}/g);
        for (const m of matches) {
          fieldPrefixes[m[1]] = true;
        }
      }
      const fieldNames = Object.keys(fieldPrefixes);

      // 按 keyword_id 顺序匹配字段名前缀
      const fields = [];
      let idx = 0;
      for (const kw of (tpl.keywordEnumValueList || [])) {
        fields.push({
          name: fieldNames[idx] || ('thing' + kw.keyword_id),
          label: kw.name || '',
          example: kw.example || '',
        });
        idx++;
      }

      result[tpl.priTmplId] = fields;
    }
    return result;
  } catch (err) {
    log.warn({ err: err.message }, 'Failed to fetch template fields from WeChat');
    return {};
  }
}

/** 获取模板字段（带内存缓存，10分钟过期） */
async function _getTemplateFields(priTmplId) {
  if (!priTmplId) return [];
  const now = Date.now();
  if (_fieldCache && now < _cacheExpires) {
    return _fieldCache[priTmplId] || [];
  }
  _fieldCache = await _fetchTemplateFieldsFromWx();
  _cacheExpires = now + 10 * 60 * 1000;
  return _fieldCache[priTmplId] || [];
}

/** 根据字段中文名自动匹配数据源 */
function _matchSource(label) {
  const n = (label || '').toLowerCase();
  // 订单编号/号/ID
  if (n.includes('订单') && (n.includes('编号') || n.includes('号') || n.includes('id'))) return 'orderId';
  // 取餐/取货/提货码
  if (n.includes('取餐') || n.includes('取货') || n.includes('提货') || n.includes('取件')) return 'pickupCode';
  // 状态
  if (n.includes('状态') || n.includes('进度')) return 'status';
  // 门店/店铺/商家
  if (n.includes('门店') || n.includes('店铺') || n.includes('商家') || n.includes('餐厅')) return 'storeName';
  // 时间
  if (n.includes('时间') || n.includes('预约') || n.includes('取餐时间')) return 'pickupTime';
  // 金额/价格
  if (n.includes('金额') || n.includes('价格') || n.includes('支付') || n.includes('付款')) return 'paidAmount';
  // 券名称
  if ((n.includes('券') || n.includes('优惠')) && (n.includes('名称') || n.includes('类型') || n.includes('种类'))) return 'couponName';
  // 有效期
  if (n.includes('有效') || n.includes('过期') || n.includes('到期') || n.includes('期限') || n.includes('日期')) return 'validTo';
  // 提示/备注
  if (n.includes('提示') || n.includes('备注') || n.includes('说明')) return 'tip';
  return '';
}

const notificationService = {

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
    _fieldCache = null; // 清除缓存
    return this.getConfig();
  },

  // ── 发送 ─────────────────────────────────────

  async send(openid, type, valueMap, page) {
    try {
      const tplKey = TPL_KEYS[type];
      if (!tplKey) return { sent: false, reason: 'unknown_type' };
      const [[row]] = await pool.query('SELECT config_value FROM system_config WHERE config_key = ?', [tplKey]);
      const templateId = row ? row.config_value || '' : '';
      if (!templateId) return { sent: false, reason: 'no_template_id' };
      if (!openid) return { sent: false, reason: 'no_openid' };

      // 获取模板字段列表
      const fields = await _getTemplateFields(templateId);

      // 构建 data：按字段中文名匹配数据源
      const data = {};
      if (fields.length > 0) {
        for (const f of fields) {
          const src = _matchSource(f.label);
          const val = src ? (valueMap[src] || '') : '';
          if (val) {
            data[f.name] = { value: String(val).slice(0, 32) };
          } else {
            data[f.name] = { value: f.example || '-' };
          }
        }
      } else {
        // 兜底：无法获取字段列表时，发全量字段
        const v = valueMap;
        const fallback = [
          ['thing1', v.orderId || v.couponName],
          ['thing2', v.status || v.validTo],
          ['thing3', v.storeName || v.tip],
          ['thing4', v.pickupCode],
          ['thing5', v.pickupTime],
          ['thing6', v.paidAmount],
          ['character_string1', v.orderId || v.couponName],
          ['character_string2', v.pickupCode],
          ['phrase1', v.status],
          ['phrase2', v.storeName || v.tip],
        ];
        for (const [k, val] of fallback) {
          if (val) data[k] = { value: String(val).slice(0, 32) };
        }
      }

      const accessToken = await getAccessToken();
      const url = `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${accessToken}`;

      const body = {
        touser: openid,
        template_id: templateId,
        page: page || '',
        data,
        miniprogram_state: await (async () => {
          try {
            const [[r]] = await pool.query('SELECT config_value FROM system_config WHERE config_key = ?', [STATE_KEY]);
            if (r && r.config_value) return r.config_value;
          } catch (_) {}
          return process.env.NODE_ENV === 'production' ? 'formal' : 'developer';
        })(),
      };

      const { data: resp } = await axios.post(url, body, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 8000,
      });

      if (resp.errcode === 0) {
        log.info({ openid, type, fields: Object.keys(data) }, 'Subscribe message sent');
        return { sent: true };
      }

      log.warn({ openid, type, errcode: resp.errcode, errmsg: resp.errmsg }, 'Send failed');
      return { sent: false, errcode: resp.errcode, errmsg: resp.errmsg };
    } catch (err) {
      log.error({ err, openid, type }, 'Send error');
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
