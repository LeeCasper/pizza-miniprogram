/**
 * API Service Layer
 * Encapsulates wx.request with JWT auth, auto-retry on 401, and error handling.
 */

// Production domain; change to localhost for local dev
const BASE_URL = 'https://pizza.artaides.com/api/v1';

let pendingLoginPromise = null;

/**
 * Ensure we have a valid token before making authenticated requests.
 * - Token exists → resolve immediately
 * - User deliberately logged out → resolve (let request 401 naturally)
 * - Login already in-flight → wait for it
 * - No token and not logged out → start a new login
 *
 * Silently catches login failures — the request proceeds without auth
 * and will 401, which the caller or the 401 handler can deal with.
 */
function ensureToken() {
  if (wx.getStorageSync('token')) return Promise.resolve();
  // 已主动退出：拒绝而不是 resolve，避免无 token 请求打出 401
  if (wx.getStorageSync('_loggedOut')) return Promise.reject(new Error('LOGGED_OUT'));
  if (pendingLoginPromise) {
    return pendingLoginPromise.then(function () {}).catch(function () {});
  }
  return doLogin().then(function () {}).catch(function () {});
}

/**
 * Core request function
 */
function request(path, options) {
  if (!options) options = {};
  var method = options.method || 'GET';
  var data = options.data;
  var needAuth = options.needAuth !== false;

  function sendRequest() {
    var token = wx.getStorageSync('token');

    return new Promise(function (resolve, reject) {
      wx.request({
        url: BASE_URL + path,
        method: method,
        data: data,
        header: {
          'Content-Type': 'application/json',
          ...(needAuth && token ? { 'Authorization': 'Bearer ' + token } : {}),
        },
        success: function (res) {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(res.data);
          } else if (res.statusCode === 401 && needAuth) {
            // 已主动退出，不再自动重登
            if (wx.getStorageSync('_loggedOut')) {
              reject(res.data || { code: 401, message: '未登录' });
              return;
            }
            // Token expired — re-login and retry once
            doLogin().then(function () {
              request(path, options).then(resolve).catch(reject);
            }).catch(reject);
          } else {
            var message = (res.data && res.data.message) || '请求失败';
            wx.showToast({ title: message, icon: 'none' });
            reject(res.data || { code: res.statusCode, message });
          }
        },
        fail: function (err) {
          wx.showToast({ title: '网络异常，请检查网络', icon: 'none' });
          reject(err);
        },
      });
    });
  }

  // Before making authenticated request, ensure we have a token
  if (needAuth) {
    return ensureToken().then(sendRequest).catch(function (err) {
      // 主动退出 → 静默返回 null，不打出 401 请求
      if (err && err.message === 'LOGGED_OUT') return null;
      throw err;
    });
  }
  return sendRequest();
}

/**
 * Perform WeChat login and obtain JWT token
 */
function doLogin() {
  // Avoid concurrent login calls
  if (pendingLoginPromise) return pendingLoginPromise;

  pendingLoginPromise = new Promise((resolve, reject) => {
    wx.login({
      success(res) {
        if (!res.code) {
          pendingLoginPromise = null;
          reject(new Error('wx.login 失败'));
          return;
        }
        wx.request({
          url: BASE_URL + '/auth/login',
          method: 'POST',
          data: { code: res.code },
          success(result) {
            pendingLoginPromise = null;
            if (result.statusCode === 200 && result.data.code === 0) {
              const { token, user } = result.data.data;
              // 登录成功，清除退出标记
              wx.removeStorageSync('_loggedOut');
              wx.setStorageSync('token', token);
              wx.setStorageSync('userInfo', user);
              resolve(user);
            } else {
              reject(new Error('登录失败'));
            }
          },
          fail(err) {
            pendingLoginPromise = null;
            reject(err);
          },
        });
      },
      fail(err) {
        pendingLoginPromise = null;
        reject(err);
      },
    });
  });

  return pendingLoginPromise;
}

/**
 * Convenience methods
 */
const api = {
  get(path, data)  { return request(path, { method: 'GET', data }); },
  post(path, data) { return request(path, { method: 'POST', data }); },
  put(path, data)  { return request(path, { method: 'PUT', data }); },
  del(path)        { return request(path, { method: 'DELETE' }); },
  login()          { return doLogin(); },
};

/**
 * Fix image URL: prepend domain to relative paths so WeChat <image> loads from network.
 * Full URLs (https://...) are returned unchanged. http:// is upgraded to https://.
 */
function fixImageUrl(url) {
  if (!url) return url;
  if (url.startsWith('https://')) return url;
  if (url.startsWith('http://')) return url.replace('http://', 'https://');
  if (url.startsWith('/uploads/')) return 'https://pizza.artaides.com' + url;
  if (url.startsWith('uploads/')) return 'https://pizza.artaides.com/' + url;
  return url;
}

module.exports = { api, doLogin, fixImageUrl, BASE_URL };
