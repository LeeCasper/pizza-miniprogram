// pages/store/store.js
const { api } = require('../../utils/api');
const { calculateWalkingDistance, formatDistance } = require('../../utils/mapConfig');
const app = getApp();
const { getSimpleTopBar } = require('../../utils/layout');

// 默认门店坐标（fallback，GCJ-02）
const DEFAULT_LAT = 32.961857;
const DEFAULT_LNG = 114.646879;

// 自取须知默认文案（后台未配置时回退）
const DEFAULT_PICKUP_NOTICES = [
  '订单制作通常需要 15-20 分钟，请根据提示时间前往门店取餐。',
  '到店后，请向店员出示您的取餐码或预留手机号。',
  '为保证比萨口感，建议您在制作完成后 10 分钟内取餐。',
];

Page({
  data: {
    statusBarHeight: 44,
    topBarTotalHeight: 80,
    store: null,
    loading: true,
    pickupNotices: DEFAULT_PICKUP_NOTICES,

    // 地图
    mapLatitude: DEFAULT_LAT,
    mapLongitude: DEFAULT_LNG,
    mapScale: 15,
    markers: [],
    includePoints: [],

    // 用户定位
    userLatitude: null,
    userLongitude: null,
    distance: '',
    showUserLocation: false,
    locationWatching: false,
  },

  // 距离计算节流时间戳
  _lastDistCalc: 0,
  _locating: false,
  _locationRequested: false,

  onLoad() {
    this.setData(getSimpleTopBar());
    this.fetchStore();
  },

  onUnload() {
    // 页面卸载：停止实时位置追踪，省电
    if (this.data.locationWatching) {
      wx.stopLocationUpdate({ fail() {} });
      wx.offLocationChange();
    }
  },

  fetchStore() {
    this.setData({ loading: true });
    api.get('/stores').then(res => {
      if (res.code === 0 && res.data && res.data.length > 0) {
        const raw = res.data[0];
        // Ensure lat/lng are numbers (mysql2 may return DECIMAL as strings)
        const store = {
          ...raw,
          latitude: raw.latitude != null ? parseFloat(raw.latitude) : null,
          longitude: raw.longitude != null ? parseFloat(raw.longitude) : null,
        };
        const pickupNotices = this.parsePickupNotices(store.pickup_notice);
        this.setData({ store, pickupNotices, loading: false });
        this.initMap();
      } else {
        this.setData({ loading: false });
      }
    }).catch(() => {
      this.setData({ loading: false });
    });
  },

  /**
   * 解析后台「自取须知」(多行文本,每行一条);为空时回退默认三条
   */
  parsePickupNotices(raw) {
    if (!raw || typeof raw !== 'string') return DEFAULT_PICKUP_NOTICES;
    const lines = raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    return lines.length ? lines : DEFAULT_PICKUP_NOTICES;
  },

  // ===== 地图初始化 =====

  initMap() {
    const store = this.data.store;
    if (!store) return;

    const lat = store.latitude || DEFAULT_LAT;
    const lng = store.longitude || DEFAULT_LNG;

    this.setData({
      mapLatitude: lat,
      mapLongitude: lng,
    });
    this.updateMarkers();
    this.requestLocation();
  },

  // ===== 定位 =====

  /**
   * 首次定位，然后开启实时追踪。
   * 地图组件的 show-location 也会触发定位授权，因此先保持关闭；
   * 只在 wx.getLocation 成功后打开，避免进入页面时重复授权。
   */
  requestLocation() {
    if (this._locating || this._locationRequested) return;
    this._locating = true;
    this._locationRequested = true;

    wx.getLocation({
      type: 'gcj02',
      isHighAccuracy: true,
      highAccuracyExpireTime: 3000,
      success: (loc) => {
        this._locating = false;
        this.setData({ showUserLocation: true });
        this.onLocationUpdate(loc.latitude, loc.longitude);
        this.startLocationWatch();
      },
      fail: (err) => {
        this._locating = false;
        const msg = (err && err.errMsg) || '';
        if (msg.indexOf('deny') > -1 || msg.indexOf('auth') > -1) {
          wx.showModal({
            title: '需要位置权限',
            content: '授权位置信息后，可查看到店距离和导航路线',
            confirmText: '去设置',
            cancelText: '暂不授权',
            success: (res) => {
              if (res.confirm) {
                wx.openSetting({
                  success: (settingRes) => {
                    if (settingRes.authSetting && settingRes.authSetting['scope.userLocation']) {
                      this._locationRequested = false;
                      this.requestLocation();
                    }
                  },
                });
              }
            },
          });
        }
      },
    });
  },

  /**
   * 开启实时位置追踪
   */
  startLocationWatch() {
    if (this.data.locationWatching) return;

    wx.startLocationUpdate({
      type: 'gcj02',
      success: () => {
        this.setData({ locationWatching: true });
        wx.onLocationChange((loc) => {
          this.onLocationUpdate(loc.latitude, loc.longitude);
        });
      },
      fail: () => {
        // 实时追踪开启失败，保留首次定位结果
      },
    });
  },

  /**
   * 位置更新回调（首次 + 实时）
   */
  onLocationUpdate(lat, lng) {
    this.setData({ userLatitude: lat, userLongitude: lng });
    this.updateMarkers();

    // 节流：5秒内最多调用一次距离计算
    const now = Date.now();
    if (now - this._lastDistCalc < 5000) return;
    this._lastDistCalc = now;
    this.calculateDistance();
  },

  // ===== 标记 & 视野 =====

  updateMarkers() {
    const s = this.data.store;
    if (!s) return;

    const storeLat = s.latitude || DEFAULT_LAT;
    const storeLng = s.longitude || DEFAULT_LNG;

    const markers = [{
      id: 1,
      latitude: storeLat,
      longitude: storeLng,
      title: s.name || '王姐手工披萨',
      width: 32,
      height: 32,
      callout: {
        content: s.name || '王姐手工披萨',
        color: '#C0563A',
        fontSize: 14,
        borderRadius: 8,
        bgColor: '#FFFFFF',
        padding: 8,
        display: 'ALWAYS',
      },
    }];

    const includePoints = [{ latitude: storeLat, longitude: storeLng }];

    // 用户位置加入 includePoints（自动缩放视野包含两个点）
    // 用户蓝点由 <map show-location> 原生渲染，无需额外 marker
    if (this.data.userLatitude) {
      includePoints.push({
        latitude: this.data.userLatitude,
        longitude: this.data.userLongitude,
      });
    }

    this.setData({ markers, includePoints });
  },

  // ===== 距离计算 =====

  /**
   * 腾讯 WebService API 步行距离计算
   */
  calculateDistance() {
    const { userLatitude, userLongitude } = this.data;
    const s = this.data.store;
    if (!userLatitude || !s || !s.latitude || !s.longitude) return;

    calculateWalkingDistance(
      { latitude: userLatitude, longitude: userLongitude },
      { latitude: s.latitude, longitude: s.longitude }
    ).then(result => {
      this.setData({
        distance: formatDistance(result.distance, result.duration),
      });
    }).catch(() => {
      // SDK 失败 → Haversine 降级
      this.calculateDistanceFallback();
    });
  },

  /**
   * Haversine 直线距离降级
   */
  calculateDistanceFallback() {
    const { userLatitude: uLat, userLongitude: uLng } = this.data;
    const s = this.data.store;
    if (!uLat || !s || !s.latitude || !s.longitude) return;

    const R = 6371;
    const toRad = (deg) => deg * Math.PI / 180;
    const dLat = toRad(s.latitude - uLat);
    const dLng = toRad(s.longitude - uLng);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(uLat)) * Math.cos(toRad(s.latitude)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const d = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const distance = d < 1
      ? Math.round(d * 1000) + '米'
      : d.toFixed(1) + '公里';
    this.setData({ distance });
  },

  // ===== 交互 =====

  /**
   * 定位按钮：重置视野包含门店和用户
   */
  onLocate() {
    const s = this.data.store;
    if (!s) return;

    if (!this.data.userLatitude) {
      this._locationRequested = false;
      this.requestLocation();
      return;
    }

    const storeLat = s.latitude || DEFAULT_LAT;
    const storeLng = s.longitude || DEFAULT_LNG;

    this.setData({
      mapLatitude: (storeLat + this.data.userLatitude) / 2,
      mapLongitude: (storeLng + this.data.userLongitude) / 2,
    });
    this.updateMarkers();
  },

  onViewMap() {
    const store = this.data.store;
    if (!store || !store.latitude || !store.longitude) {
      wx.showToast({ title: '暂无门店位置信息', icon: 'none' });
      return;
    }
    wx.openLocation({
      latitude: store.latitude,
      longitude: store.longitude,
      name: store.name || '王姐手工披萨',
      address: store.address || '',
      scale: 16,
    });
  },

  onCallStore() {
    const phone = this.data.store ? this.data.store.phone : '';
    if (!phone) {
      wx.showToast({ title: '暂无联系电话', icon: 'none' });
      return;
    }
    wx.makePhoneCall({
      phoneNumber: phone.replace(/-/g, ''),
      fail() {},
    });
  },

  onBack() {
    wx.navigateBack();
  },
});
