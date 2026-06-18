// pages/store/store.js
const { api } = require('../../utils/api');
const app = getApp();

// 默认门店坐标（fallback，GCJ-02）
const DEFAULT_LAT = 39.9332;
const DEFAULT_LNG = 116.4544;

Page({
  data: {
    statusBarHeight: 44,
    topBarTotalHeight: 80,
    store: null,
    loading: true,

    // 地图状态
    mapLatitude: DEFAULT_LAT,
    mapLongitude: DEFAULT_LNG,
    mapScale: 15,
    markers: [],

    // 用户定位
    userLatitude: null,
    userLongitude: null,
    locationGranted: false,
    distance: '',
  },

  onLoad() {
    const sh = app.globalData.statusBarHeight;
    const topBarH = sh + 36;
    this.setData({
      statusBarHeight: sh,
      topBarTotalHeight: topBarH,
    });
    this.fetchStore();
  },

  fetchStore() {
    this.setData({ loading: true });
    api.get('/stores').then(res => {
      if (res.code === 0 && res.data && res.data.length > 0) {
        this.setData({ store: res.data[0], loading: false });
        this.initMap();
      } else {
        this.setData({ loading: false });
      }
    }).catch(() => {
      this.setData({ loading: false });
    });
  },

  /**
   * 初始化地图：设置中心、创建标记、请求用户定位
   */
  initMap() {
    const store = this.data.store;
    if (!store) return;

    const lat = store.latitude || DEFAULT_LAT;
    const lng = store.longitude || DEFAULT_LNG;

    const markers = [{
      id: 1,
      latitude: lat,
      longitude: lng,
      title: store.name || '王姐手工披萨',
      width: 32,
      height: 32,
      callout: {
        content: store.name || '王姐手工披萨',
        color: '#D32F2F',
        fontSize: 14,
        borderRadius: 8,
        bgColor: '#FFFFFF',
        padding: 8,
        display: 'ALWAYS',
      },
    }];

    this.setData({
      mapLatitude: lat,
      mapLongitude: lng,
      markers: markers,
    });

    this.requestLocation();
  },

  /**
   * 请求用户定位权限并获取位置
   */
  requestLocation() {
    wx.getSetting({
      success: (res) => {
        if (res.authSetting['scope.userLocation'] === false) {
          // 用户之前拒绝过 → 不再弹窗，降级处理
          this.setData({ locationGranted: false, distance: '' });
          return;
        }
        // 未曾询问或已授权 → 调用 getLocation
        wx.getLocation({
          type: 'gcj02',
          success: (loc) => {
            this.setData({
              userLatitude: loc.latitude,
              userLongitude: loc.longitude,
              locationGranted: true,
            });
            this.calculateDistance();
          },
          fail: () => {
            this.setData({ locationGranted: false, distance: '' });
          },
        });
      },
    });
  },

  /**
   * Haversine 公式计算用户与门店的距离
   */
  calculateDistance() {
    const { userLatitude: uLat, userLongitude: uLng } = this.data;
    const s = this.data.store;
    if (!uLat || !s || !s.latitude || !s.longitude) return;

    const R = 6371; // 地球半径（公里）
    const toRad = (deg) => deg * Math.PI / 180;
    const dLat = toRad(s.latitude - uLat);
    const dLng = toRad(s.longitude - uLng);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(uLat)) * Math.cos(toRad(s.latitude)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c;

    const distance = d < 1
      ? Math.round(d * 1000) + ' 米'
      : d.toFixed(1) + ' 公里';

    this.setData({ distance });
  },

  /**
   * 定位按钮：将地图中心重置到门店位置
   */
  onLocate() {
    const store = this.data.store;
    if (!store) return;
    this.setData({
      mapLatitude: store.latitude || DEFAULT_LAT,
      mapLongitude: store.longitude || DEFAULT_LNG,
      mapScale: 15,
    });
  },

  /**
   * "查看地图"：打开微信内置全屏地图（自带导航按钮）
   */
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

  /**
   * "导航到店"按钮
   */
  onNavigate() {
    this.onViewMap();
  },

  /**
   * 电话图标：拨打门店电话
   */
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

  /**
   * "联系客服"按钮（底部操作区）
   */
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
