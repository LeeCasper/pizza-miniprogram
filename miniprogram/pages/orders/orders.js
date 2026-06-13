// pages/orders/orders.js
const { orders } = require('../../utils/data');
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
    filteredOrders: []
  },

  onLoad() {
    const sh = app.globalData.statusBarHeight;
    // 预处理取餐码为数字数组
    const ordersWithDigits = orders.map(o => ({
      ...o,
      codeDigits: String(o.pickupCode).split('')
    }));
    this.setData({
      statusBarHeight: sh,
      topBarTotalHeight: sh + 36,
      orders: ordersWithDigits,
      filteredOrders: ordersWithDigits
    });
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

  onShow() {
    const tabBar = this.getTabBar();
    if (tabBar && tabBar.data.selected !== 1) {
      tabBar.setData({ selected: 1 });
    }
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
    wx.showModal({
      title: '取消订单',
      content: '确定要取消该订单吗？',
      success: (res) => {
        if (res.confirm) {
          wx.showToast({ title: '订单已取消', icon: 'success' });
        }
      }
    });
  },

});
