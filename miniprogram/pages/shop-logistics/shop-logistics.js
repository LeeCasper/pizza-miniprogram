// pages/shop-logistics/shop-logistics.js — 物流追踪（黏土风）
const { api, fixImageUrl } = require('../../utils/api');
const { getBackBtnTopBar } = require('../../utils/layout');

Page({
  data: {
    topBarTotalHeight: 80,
    statusBarHeight: 44,
    orders: [],
    loading: true,
    expandedId: null,
    loadingDetail: false,
  },

  onLoad() {
    this.setData(getBackBtnTopBar());
  },

  onShow() {
    this.fetchOrders();
  },

  fetchOrders() {
    this.setData({ loading: true });
    api.get('/logistics/orders').then(res => {
      if (res.code === 0 && res.data) {
        const orders = (res.data.list || []).map(o => ({
          ...o,
          items: (o.items || []).map(it => ({
            ...it,
            productImage: fixImageUrl(it.productImage),
          })),
          expanded: false,
          trackingEvents: null,
        }));
        this.setData({ orders, loading: false });
      } else {
        this.setData({ orders: [], loading: false });
      }
    }).catch(() => {
      this.setData({ orders: [], loading: false });
    });
  },

  onBack() { wx.navigateBack(); },

  // Toggle card expansion: fetch full tracking if not already loaded
  onToggleTracking(e) {
    const { id } = e.currentTarget.dataset;
    const orders = this.data.orders;
    const idx = orders.findIndex(o => o.id === id);
    if (idx === -1) return;

    const order = orders[idx];

    // Collapse
    if (order.expanded) {
      orders[idx] = { ...order, expanded: false };
      this.setData({ orders, expandedId: null });
      return;
    }

    // Expand: if already have events, just toggle
    if (order.trackingEvents) {
      orders[idx] = { ...order, expanded: true };
      this.setData({ orders, expandedId: id });
      return;
    }

    // First expand — fetch detail
    this.setData({ loadingDetail: true, expandedId: id });
    api.get('/logistics/track/' + id).then(res => {
      if (res.code === 0 && res.data) {
        orders[idx] = {
          ...order,
          expanded: true,
          trackingEvents: res.data.events || [],
          trackingStateLabel: res.data.stateLabel,
          isDelivered: res.data.isDelivered,
        };
      } else {
        orders[idx] = { ...order, expanded: true, trackingEvents: [] };
      }
      this.setData({ orders, loadingDetail: false });
    }).catch(() => {
      orders[idx] = { ...order, expanded: true, trackingEvents: [] };
      this.setData({ orders, loadingDetail: false });
      wx.showToast({ title: '查询物流失败', icon: 'none' });
    });
  },

  // Navigate to order detail
  onTapOrder(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({ url: '/pages/shop-order-detail/shop-order-detail?id=' + id });
  },
});
