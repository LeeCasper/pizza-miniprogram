/**
 * API Service Layer
 * Encapsulates wx.request with JWT auth, auto-retry on 401, and error handling.
 */

// Production domain; change to localhost for local dev
const BASE_URL = 'https://www.artaides.com/api/v1';

let pendingLoginPromise = null;

/**
 * Core request function
 */
function request(path, options = {}) {
  const { method = 'GET', data, needAuth = true } = options;
  const token = wx.getStorageSync('token');

  return new Promise((resolve, reject) => {
    wx.request({
      url: BASE_URL + path,
      method,
      data,
      header: {
        'Content-Type': 'application/json',
        ...(needAuth && token ? { 'Authorization': 'Bearer ' + token } : {}),
      },
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else if (res.statusCode === 401 && needAuth) {
          // Token expired — re-login and retry once
          doLogin().then(() => {
            request(path, options).then(resolve).catch(reject);
          }).catch(reject);
        } else {
          const message = (res.data && res.data.message) || '请求失败';
          wx.showToast({ title: message, icon: 'none' });
          reject(res.data || { code: res.statusCode, message });
        }
      },
      fail(err) {
        wx.showToast({ title: '网络异常，请检查网络', icon: 'none' });
        reject(err);
      },
    });
  });
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

module.exports = { api, doLogin };
