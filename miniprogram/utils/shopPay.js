// utils/shopPay.js — 商城订单支付（镜像 utils/pay.js，调用 /shop/pay 端点）
const { api } = require('./api');

/**
 * 商城订单微信支付
 * @param {string} orderId — shop_orders.id
 * @returns {Promise<{success: boolean, status?: string}>}
 */
function payShopOrder(orderId) {
  return new Promise((resolve, reject) => {
    // 1. 获取支付参数
    api.post('/shop/pay', { orderId }).then(res => {
      if (res.code !== 0 || !res.data || !res.data.payParams) {
        reject(new Error(res.message || '获取支付参数失败'));
        return;
      }

      const { payParams } = res.data;

      // 2. 调起微信支付
      wx.requestPayment({
        timeStamp: payParams.timeStamp,
        nonceStr: payParams.nonceStr,
        package: payParams.package,
        signType: payParams.signType || 'RSA',
        paySign: payParams.paySign,
        success() {
          // 3. 轮询支付状态
          pollPaymentStatus(orderId, 5).then(status => {
            resolve({ success: true, status });
          }).catch(() => {
            // 轮询失败不影响 —— 微信已扣款，回调会处理
            resolve({ success: true, status: 'pending' });
          });
        },
        fail(err) {
          if (err.errMsg && err.errMsg.indexOf('cancel') !== -1) {
            resolve({ success: false, status: 'cancelled' });
          } else {
            reject(err);
          }
        },
      });
    }).catch(reject);
  });
}

/**
 * 轮询支付状态（指数退避）
 */
function pollPaymentStatus(orderId, remaining) {
  if (remaining <= 0) return Promise.resolve('pending');

  const delays = [1500, 2000, 3000, 4000, 5000];
  const delay = delays[5 - remaining] || 5000;

  return new Promise(resolve => {
    setTimeout(() => {
      api.get('/shop/pay/' + orderId + '/status').then(res => {
        if (res.code === 0 && res.data) {
          const s = res.data;
          if (s.status === 'success' || s.orderStatus === 'paid') {
            resolve('paid');
          } else if (s.status === 'closed' || s.status === 'failed') {
            resolve('failed');
          } else {
            resolve(pollPaymentStatus(orderId, remaining - 1));
          }
        } else {
          resolve(pollPaymentStatus(orderId, remaining - 1));
        }
      }).catch(() => {
        resolve(pollPaymentStatus(orderId, remaining - 1));
      });
    }, delay);
  });
}

module.exports = { payShopOrder };
