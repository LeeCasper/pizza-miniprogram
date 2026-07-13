// utils/orders.js — 订单格式化共享模块
// 统一 STATUS_MAP 和 formatOrder，避免 main.js / orders.js 重复

const ORDER_STATUS_MAP = {
  waiting: '待取餐',
  preparing: '待取餐',
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
    paymentStatusText: o.paymentMethod === 'wechat' ? '微信支付'
      : o.paymentMethod === 'balance' ? '余额支付'
      : o.paymentMethod === 'coupon' ? '兑换券'
      : '待支付',
    isPaid: !!o.paymentMethod,
    canCancel: !!o.canCancel,
    cancelDeadline: o.cancelDeadline || null,
    pickupTimeText: formatPickupTimeText(o.pickupTime),
    canPickup: o.status === 'waiting',
    couponDiscount: parseFloat(o.couponDiscount || 0),
    tierDiscount: parseFloat(o.tierDiscount || 0),
  };
}

function formatPickupTimeText(isoStr) {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return '';
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hour = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${month}-${day} ${hour}:${min}`;
  } catch (_) { return ''; }
}

module.exports = { ORDER_STATUS_MAP, formatOrder };
