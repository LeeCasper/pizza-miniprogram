/**
 * 腾讯位置服务 WebService API 封装
 * 文档: https://lbs.qq.com/service/webService/webServiceGuide/webServiceOverview
 *
 * API Key 从后台管理配置（GET /api/v1/config/map），首次调用时自动获取并缓存。
 * 使用前须在微信公众平台添加 request 合法域名: https://apis.map.qq.com
 */

const { api } = require('./api');

const API_BASE = 'https://apis.map.qq.com';

// 内存缓存：仅请求一次服务端
let _mapKey = '';
let _keyPromise = null;

/**
 * 从服务端获取腾讯地图 API Key（单次请求，之后缓存）
 * @returns {Promise<string>} Key 或空字符串
 */
function ensureMapKey() {
  if (_mapKey) return Promise.resolve(_mapKey);
  if (_keyPromise) return _keyPromise;

  _keyPromise = api.get('/config/map').then(res => {
    if (res.code === 0 && res.data && res.data.tencentKey) {
      _mapKey = res.data.tencentKey;
    }
    _keyPromise = null;
    return _mapKey;
  }).catch(() => {
    _keyPromise = null;
    return '';
  });

  return _keyPromise;
}

/**
 * 计算步行距离和预计时间
 * @param {Object} from - { latitude, longitude }
 * @param {Object} to   - { latitude, longitude }
 * @returns {Promise<{ distance: number, duration: number }>}
 *   distance: 距离（米）, duration: 时间（秒）
 */
function calculateWalkingDistance(from, to) {
  return ensureMapKey().then(key => {
    if (!key) return Promise.reject(new Error('MAP_KEY not configured'));

    return new Promise((resolve, reject) => {
      wx.request({
        url: `${API_BASE}/ws/distance/v1/matrix`,
        data: {
          mode: 'walking',
          from: `${from.latitude},${from.longitude}`,
          to: `${to.latitude},${to.longitude}`,
          key: key,
        },
        success(res) {
          if (res.data && res.data.status === 0) {
            const el = res.data.result.rows[0].elements[0];
            resolve({ distance: el.distance, duration: el.duration });
          } else {
            reject(new Error(res.data ? res.data.message : 'API error'));
          }
        },
        fail(err) {
          reject(err);
        },
      });
    });
  });
}

/**
 * 逆地理编码：坐标 → 地址
 * @param {number} latitude
 * @param {number} longitude
 * @returns {Promise<Object>} result 对象
 */
function reverseGeocode(latitude, longitude) {
  return ensureMapKey().then(key => {
    if (!key) return Promise.reject(new Error('MAP_KEY not configured'));

    return new Promise((resolve, reject) => {
      wx.request({
        url: `${API_BASE}/ws/geocoder/v1/`,
        data: {
          location: `${latitude},${longitude}`,
          key: key,
        },
        success(res) {
          if (res.data && res.data.status === 0) {
            resolve(res.data.result);
          } else {
            reject(new Error(res.data ? res.data.message : 'API error'));
          }
        },
        fail(err) {
          reject(err);
        },
      });
    });
  });
}

/**
 * 格式化距离+时间为可读文本
 * @param {number} meters - 距离（米）
 * @param {number} seconds - 时间（秒）
 * @returns {string} 例如 "1.2公里 · 步行约15分钟"
 */
function formatDistance(meters, seconds) {
  const dist = meters < 1000
    ? meters + '米'
    : (meters / 1000).toFixed(1) + '公里';
  const minutes = Math.ceil(seconds / 60);
  return dist + ' · 步行约' + minutes + '分钟';
}

module.exports = {
  ensureMapKey,
  calculateWalkingDistance,
  reverseGeocode,
  formatDistance,
};
