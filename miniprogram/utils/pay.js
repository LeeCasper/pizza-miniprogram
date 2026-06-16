/**
 * WeChat Pay Utility
 *
 * Encapsulates the payment flow for both order checkout and balance recharge.
 *
 * Flow:
 *   1. Client calls createPayment() with orderId or recharge amount
 *   2. Backend creates WeChat Pay JSAPI prepay session, returns params
 *   3. Client calls wx.requestPayment() with those params
 *   4. On success, returns the result
 */

const { api } = require('./api');

/**
 * Pay for an order via WeChat Pay.
 *
 * @param {string} orderId
 * @returns {Promise<{ success: boolean, transactionId?: string }>}
 */
function payOrder(orderId) {
  return new Promise((resolve, reject) => {
    wx.showLoading({ title: '拉起支付...' });

    api.post('/pay/order', { orderId })
      .then(res => {
        wx.hideLoading();
        if (res.code !== 0 || !res.data || !res.data.payParams) {
          wx.showToast({ title: res.message || '预支付失败', icon: 'none' });
          reject(new Error(res.message || '预支付失败'));
          return;
        }

        const { payParams } = res.data;

        wx.requestPayment({
          timeStamp: payParams.timeStamp,
          nonceStr: payParams.nonceStr,
          package: payParams.package,
          signType: payParams.signType || 'RSA',
          paySign: payParams.paySign,
          success: () => {
            wx.showToast({ title: '支付成功', icon: 'success' });
            resolve({ success: true });
          },
          fail: (wxErr) => {
            if (wxErr.errMsg && wxErr.errMsg.indexOf('cancel') !== -1) {
              wx.showToast({ title: '已取消支付', icon: 'none' });
              reject(Object.assign(new Error('用户取消支付'), { cancelled: true }));
            } else {
              wx.showToast({ title: '支付失败，请重试', icon: 'none' });
              reject(wxErr);
            }
          },
        });
      })
      .catch(err => {
        wx.hideLoading();
        wx.showToast({ title: '支付异常，请重试', icon: 'none' });
        reject(err);
      });
  });
}

/**
 * Recharge balance via WeChat Pay.
 *
 * @param {number} amount - Recharge amount (RMB)
 * @returns {Promise<{ success: boolean }>}
 */
function rechargeBalance(amount) {
  return new Promise((resolve, reject) => {
    wx.showLoading({ title: '拉起支付...' });

    api.post('/pay/recharge', { amount })
      .then(res => {
        wx.hideLoading();
        if (res.code !== 0 || !res.data || !res.data.payParams) {
          wx.showToast({ title: res.message || '预支付失败', icon: 'none' });
          reject(new Error(res.message || '预支付失败'));
          return;
        }

        const { payParams } = res.data;

        wx.requestPayment({
          timeStamp: payParams.timeStamp,
          nonceStr: payParams.nonceStr,
          package: payParams.package,
          signType: payParams.signType || 'RSA',
          paySign: payParams.paySign,
          success: () => {
            wx.showToast({ title: '充值成功', icon: 'success' });
            resolve({ success: true });
          },
          fail: (wxErr) => {
            if (wxErr.errMsg && wxErr.errMsg.indexOf('cancel') !== -1) {
              wx.showToast({ title: '已取消充值', icon: 'none' });
              reject(Object.assign(new Error('用户取消充值'), { cancelled: true }));
            } else {
              wx.showToast({ title: '支付失败，请重试', icon: 'none' });
              reject(wxErr);
            }
          },
        });
      })
      .catch(err => {
        wx.hideLoading();
        wx.showToast({ title: '支付异常，请重试', icon: 'none' });
        reject(err);
      });
  });
}

module.exports = { payOrder, rechargeBalance };
