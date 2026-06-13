// pages/orders/orders.js
const { api } = require('../../utils/api');
const app = getApp();

Page({
  data: {
    statusBarHeight: 44,
    topBarTotalHeight: 80,
    tabs: [
      { key: 'all', name: '全部' },
      { key: 'preparing', name: '制作中' },
      { key: 'waiting', name: '待取餐' },
      { key: 'completed', name: '已完成' }
    ],
    activeTab: 'all',
    orders: [],
    filteredOrders: [],
    loading: true,
  },

  onLoad() {
    const sh = app.globalData.statusBarHeight;
    this.setData({
      statusBarHeight: sh,
      topBarTotalHeight: sh + 36,
    });
    this.fetchOrders();
  },

  onShow() {
    const tabBar = this.getTabBar();
    if (tabBar && tabBar.data.selected !== 1) {
      tabBar.setData({ selected: 1 });
    }
    // Refresh orders each time the tab shows
    if (!this.data.loading) {
      this.fetchOrders();
    }
  },

  fetchOrders() {
    this.setData({ loading: true });
    api.get('/orders').then(res => {
      if (res.code === 0) {
        const ordersWithDigits = (res.data || []).map(o => ({
          ...o,
          codeDigits: String(o.pickupCode || '').split(''),
          time: o.createdAt ? o.createdAt : (o.time || ''),
        }));
        this.setData({ orders: ordersWithDigits, loading: false });
        this.filterOrders();
      } else {
        this.setData({ loading: false });
      }
    }).catch(() => {
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    });
  },

  onPullDownRefresh() {
    this.fetchOrders();
    wx.stopPullDownRefresh();
  },

  onTabChange(e) {
    const { key } = e.currentTarget.dataset;
    this.setData({ activeTab: key });
    this.filterOrders();
  },

  filterOrders() {
    const { activeTab, orders } = this.data;
    let filtered;
    if (activeTab === 'all') {
      filtered = [...orders];
    } else {
      filtered = orders.filter(o => o.status === activeTab);
    }
    this.setData({ filteredOrders: filtered });
  },

  onOrderDetail(e) {
    const { id } = e.currentTarget.dataset;
    wx.showToast({ title: '订单详情: ' + id, icon: 'none' });
  },

  onShowPickupCode(e) {
    const { id } = e.currentTarget.dataset;
    const { filteredOrders, orders } = this.data;
    const update = (list) => list.map(o => {
      if (o.id === id) return { ...o, codeRevealed: true };
      return o;
    });
    this.setData({
      filteredOrders: update(filteredOrders),
      orders: update(orders)
    });
  },

  onHidePickupCode(e) {
    const { id } = e.currentTarget.dataset;
    const { filteredOrders, orders } = this.data;
    const update = (list) => list.map(o => {
      if (o.id === id) return { ...o, codeRevealed: false };
      return o;
    });
    this.setData({
      filteredOrders: update(filteredOrders),
      orders: update(orders)
    });
  },

  onCancelOrder(e) {
    const { id } = e.currentTarget.dataset;
    wx.showModal({
      title: '取消订单',
      content: '确定要取消该订单吗？',
      success: (res) => {
        if (res.confirm) {
          api.put('/orders/' + id + '/cancel').then(result => {
            if (result.code === 0) {
              wx.showToast({ title: '订单已取消', icon: 'success' });
              this.fetchOrders();
            }
          }).catch(() => {
            wx.showToast({ title: '取消失败', icon: 'none' });
          });
        }
      }
    });
  },
});
