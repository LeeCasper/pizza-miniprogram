/**
 * 订阅消息工具
 *
 * 使用方式：
 *   const subscribe = require('../../utils/subscribe');
 *   subscribe.askOrderNotify();    // 请求订单通知授权
 *   subscribe.askCouponNotify();   // 请求优惠券通知授权
 *
 * 模板 ID 从服务端配置获取，前端缓存在 storage 中避免重复请求。
 * 微信限定：每次调用最多可请求 3 个模板，且必须在用户点击事件中触发。
 */

const { api } = require('./api');

// 缓存模板 ID 和上次请求时间（避免短时间内重复弹窗）
const CACHE_KEY = '_subTplIds';
const LAST_ASK_KEY = '_subLastAsk';
const COOLDOWN_MS = 60 * 60 * 1000; // 同一类型 1 小时内不重复弹

/**
 * 拉取服务端通知配置中的模板 ID
 * @returns {Promise<{order:string, coupon:string}>}
 */
function fetchTemplateIds() {
  return new Promise((resolve) => {
    api.get('/user/notification-templates').then(res => {
      if (res && res.code === 0 && res.data) {
        const ids = { order: res.data.orderTpl || '', coupon: res.data.couponTpl || '' };
        wx.setStorageSync(CACHE_KEY, ids);
        resolve(ids);
      } else {
        resolve(wx.getStorageSync(CACHE_KEY) || { order: '', coupon: '' });
      }
    }).catch(() => {
      resolve(wx.getStorageSync(CACHE_KEY) || { order: '', coupon: '' });
    });
  });
}

/**
 * 请求订阅授权（封装 wx.requestSubscribeMessage）
 * @param {string[]} tmplIds - 模板 ID 数组
 * @returns {Promise<object>} - WeChat API 原始返回值
 */
function requestSubscribe(tmplIds) {
  const valid = tmplIds.filter(Boolean);
  if (!valid.length) return Promise.resolve({});

  return new Promise((resolve) => {
    wx.requestSubscribeMessage({
      tmplIds: valid,
      success: resolve,
      fail: resolve,  // 用户拒绝不报错
      complete: resolve,
    });
  });
}

/** 判断上次请求是否在冷却期内 */
function _inCooldown(type) {
  try {
    const last = wx.getStorageSync(LAST_ASK_KEY) || {};
    const ts = last[type] || 0;
    return (Date.now() - ts) < COOLDOWN_MS;
  } catch (_) { return false; }
}

/** 记录请求时间 */
function _markAsked(type) {
  try {
    const last = wx.getStorageSync(LAST_ASK_KEY) || {};
    last[type] = Date.now();
    wx.setStorageSync(LAST_ASK_KEY, last);
  } catch (_) {}
}

/**
 * 请求订单状态通知订阅
 * 在用户下单成功后调用（用户点击事件中）
 */
function askOrderNotify() {
  if (_inCooldown('order')) return;

  fetchTemplateIds().then(ids => {
    if (!ids.order) return;
    requestSubscribe([ids.order]).then(res => {
      _markAsked('order');
      // 服务端会根据订阅结果尝试发送通知
    });
  });
}

/**
 * 请求优惠券通知订阅
 * 在用户查看优惠券页面时调用（用户点击事件中）
 */
function askCouponNotify() {
  if (_inCooldown('coupon')) return;

  fetchTemplateIds().then(ids => {
    if (!ids.coupon) return;
    requestSubscribe([ids.coupon]).then(res => {
      _markAsked('coupon');
    });
  });
}

/**
 * 同时请求所有类型的订阅（供设置页使用）
 */
function askAllNotify() {
  fetchTemplateIds().then(ids => {
    const all = [ids.order, ids.coupon].filter(Boolean);
    if (!all.length) {
      wx.showToast({ title: '暂无可订阅的消息类型', icon: 'none' });
      return;
    }
    requestSubscribe(all);
  });
}

module.exports = { askOrderNotify, askCouponNotify, askAllNotify };
