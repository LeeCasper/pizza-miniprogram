// pages/store/store.js
const { api } = require('../../utils/api');
const { calculateWalkingDistance, formatDistance } = require('../../utils/mapConfig');
const app = getApp();
const { getSimpleTopBar } = require('../../utils/layout');

// 默认门店坐标（fallback，GCJ-02）
const DEFAULT_LAT = 32.961857;
const DEFAULT_LNG = 114.646879;

Page({
  data: {
    statusBarHeight: 44,
    topBarTotalHeight: 80,
    store: null,
    loading: true,

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
    locationWatching: false,
  },

  // 距离计算节流时间戳
  _lastDistCalc: 0,

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
        this.setData({ store, loading: false });
        this.initMap();
      } else {
        this.setData({ loading: false });
      }
    }).catch(() => {
      this.setData({ loading: false });
    });
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
   * 首次高精度定位，然后开启实时追踪
   */
  requestLocation() {
    wx.getSetting({
      success: (res) => {
        if (res.authSetting['scope.userLocation'] === false) {
          // 用户之前拒绝 → 降级
          return;
        }
        wx.getLocation({
          type: 'gcj02',
          isHighAccuracy: true,
          highAccuracyExpireTime: 3000,
          success: (loc) => {
            this.onLocationUpdate(loc.latitude, loc.longitude);
            // 首次定位成功后开启实时追踪
            this.startLocationWatch();
          },
          fail: () => {
            // 定位失败，仅显示门店
          },
        });
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
        color: '#D32F2F',
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

    const storeLat = s.latitude || DEFAULT_LAT;
    const storeLng = s.longitude || DEFAULT_LNG;

    if (this.data.userLatitude) {
      // 有用户位置 → 中心取两点中点
      this.setData({
        mapLatitude: (storeLat + this.data.userLatitude) / 2,
        mapLongitude: (storeLng + this.data.userLongitude) / 2,
      });
      this.updateMarkers(); // 触发 includePoints 重新缩放
    } else {
      this.setData({
        mapLatitude: storeLat,
        mapLongitude: storeLng,
        mapScale: 15,
      });
    }
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

  onNavigate() {
    this.onViewMap();
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

  onContactService() {
    const phone = this.data.store ? this.data.store.phone : '01088888888';
    wx.makePhoneCall({
      phoneNumber: phone.replace(/-/g, ''),
      fail() {},
    });
  },

  onStartOrder() {
    wx.navigateBack();
  },
});
