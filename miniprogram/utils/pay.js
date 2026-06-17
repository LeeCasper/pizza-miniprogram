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
 * After wx.requestPayment succeeds, polls the server to confirm the
 * payment callback has been processed. This fixes the race condition
 * where the client resolves before the WeChat callback arrives.
 *
 * @param {string} orderId
 * @returns {Promise<{ success: boolean, status?: string }>}
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
            // Poll server to confirm callback has been processed
            pollPaymentStatus(orderId, resolve);
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
 * Poll the server for payment status after wx.requestPayment succeeds.
 * The server endpoint queries WeChat Pay directly to sync state.
 *
 * @param {string} orderId
 * @param {Function} resolve
 * @param {number} attempt
 */
function pollPaymentStatus(orderId, resolve, attempt) {
  attempt = attempt || 0;
  if (attempt >= 5) {
    // Give up polling — caller should still refresh UI
    console.warn('[pay] Payment status poll exhausted, resolving with pending');
    resolve({ success: true, status: 'pending' });
    return;
  }

  // Increasing delay: 1.5s → 2s → 3s → 4s → 5s
  const delays = [1500, 2000, 3000, 4000, 5000];
  const delay = delays[attempt] || 5000;

  setTimeout(() => {
    api.get('/pay/order/' + orderId + '/status').then(res => {
      if (res.code === 0 && res.data) {
        if (res.data.status === 'success' || res.data.paymentMethod) {
          console.log('[pay] Payment confirmed by server');
          resolve({ success: true, status: 'success' });
        } else {
          pollPaymentStatus(orderId, resolve, attempt + 1);
        }
      } else {
        pollPaymentStatus(orderId, resolve, attempt + 1);
      }
    }).catch(() => {
      pollPaymentStatus(orderId, resolve, attempt + 1);
    });
  }, delay);
}

/**
 * Recharge balance via WeChat Pay.
 *
 * After wx.requestPayment succeeds, polls the server to confirm the
 * payment callback has been processed. This fixes the race condition
 * where the client resolves before the WeChat callback arrives.
 *
 * @param {number} amount - Recharge amount (RMB)
 * @returns {Promise<{ success: boolean, status?: string, outTradeNo?: string }>}
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

        const { payParams, outTradeNo } = res.data;

        wx.requestPayment({
          timeStamp: payParams.timeStamp,
          nonceStr: payParams.nonceStr,
          package: payParams.package,
          signType: payParams.signType || 'RSA',
          paySign: payParams.paySign,
          success: () => {
            wx.showToast({ title: '充值成功', icon: 'success' });
            // Poll server to confirm callback has been processed
            pollRechargeStatus(outTradeNo, resolve);
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

/**
 * Poll the server for recharge payment status after wx.requestPayment succeeds.
 *
 * @param {string} outTradeNo
 * @param {Function} resolve
 * @param {number} attempt
 */
function pollRechargeStatus(outTradeNo, resolve, attempt) {
  attempt = attempt || 0;
  if (attempt >= 5) {
    console.warn('[pay] Recharge status poll exhausted, resolving with pending');
    resolve({ success: true, status: 'pending', outTradeNo });
    return;
  }

  // Increasing delay: 1.5s → 2s → 3s → 4s → 5s
  const delays = [1500, 2000, 3000, 4000, 5000];
  const delay = delays[attempt] || 5000;

  setTimeout(() => {
    api.get('/pay/recharge/' + outTradeNo + '/status').then(res => {
      if (res.code === 0 && res.data) {
        if (res.data.status === 'success' || res.data.transactionId || res.data.balanceUpdated) {
          console.log('[pay] Recharge confirmed by server');
          resolve({ success: true, status: 'success', outTradeNo });
        } else {
          pollRechargeStatus(outTradeNo, resolve, attempt + 1);
        }
      } else {
        pollRechargeStatus(outTradeNo, resolve, attempt + 1);
      }
    }).catch(() => {
      pollRechargeStatus(outTradeNo, resolve, attempt + 1);
    });
  }, delay);
}

module.exports = { payOrder, rechargeBalance };
