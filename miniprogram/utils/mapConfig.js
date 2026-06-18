/**
 * 腾讯位置服务 WebService API 封装
 * 文档: https://lbs.qq.com/service/webService/webServiceGuide/webServiceOverview
 *
 * 使用前须在微信公众平台添加 request 合法域名: https://apis.map.qq.com
 */

const MAP_KEY = 'YOUR-TENCENT-LBS-KEY'; // ← 替换为你在 lbs.qq.com 申请的 Key

const API_BASE = 'https://apis.map.qq.com';

/**
 * 计算步行距离和预计时间
 * @param {Object} from - { latitude, longitude }
 * @param {Object} to   - { latitude, longitude }
 * @returns {Promise<{ distance: number, duration: number }>}
 *   distance: 距离（米）, duration: 时间（秒）
 */
function calculateWalkingDistance(from, to) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${API_BASE}/ws/distance/v1/matrix`,
      data: {
        mode: 'walking',
        from: `${from.latitude},${from.longitude}`,
        to: `${to.latitude},${to.longitude}`,
        key: MAP_KEY,
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
}

/**
 * 逆地理编码：坐标 → 地址
 * @param {number} latitude
 * @param {number} longitude
 * @returns {Promise<Object>} result 对象
 */
function reverseGeocode(latitude, longitude) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${API_BASE}/ws/geocoder/v1/`,
      data: {
        location: `${latitude},${longitude}`,
        key: MAP_KEY,
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
  MAP_KEY,
  calculateWalkingDistance,
  reverseGeocode,
  formatDistance,
};
