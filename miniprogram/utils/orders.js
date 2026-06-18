// utils/orders.js — 订单格式化共享模块
// 统一 STATUS_MAP 和 formatOrder，避免 main.js / orders.js 重复

const ORDER_STATUS_MAP = {
  waiting: '待取餐',
  preparing: '制作中',
  completed: '已完成',
  cancelled: '已取消'
};

/**
 * 格式化单个订单对象（添加 codeDigits、statusText 等展示字段）
 */
function formatOrder(o) {
  return {
    ...o,
    codeDigits: String(o.pickupCode || '').split(''),
    time: o.createdAt || o.time || '',
    statusText: ORDER_STATUS_MAP[o.status] || o.status,
    paymentStatusText: o.paymentMethod ? (o.paymentMethod === 'wechat' ? '微信支付' : '余额支付') : '待支付',
    isPaid: !!o.paymentMethod,
  };
}

module.exports = { ORDER_STATUS_MAP, formatOrder };
