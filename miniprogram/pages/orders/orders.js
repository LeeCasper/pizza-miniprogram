// pages/orders/orders.js
const { api } = require('../../utils/api');
const pay = require('../../utils/pay');
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
        const STATUS_MAP = { waiting: '待取餐', preparing: '制作中', completed: '已完成', cancelled: '已取消' };
        const ordersWithDigits = (res.data || []).map(o => ({
          ...o,
          codeDigits: String(o.pickupCode || '').split(''),
          time: o.createdAt ? o.createdAt : (o.time || ''),
          statusText: STATUS_MAP[o.status] || o.status,
          paymentStatusText: o.paymentMethod ? (o.paymentMethod === 'wechat' ? '微信支付' : '余额支付') : '待支付',
          isPaid: !!o.paymentMethod,
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

  onPayOrder(e) {
    const { id } = e.currentTarget.dataset;
    // Get paidAmount for optimistic growth update
    const order = (this.data.orders || []).find(o => o.id === id);
    const paidAmount = order ? (order.paidAmount || 0) : 0;

    // Optimistic: update growth value IMMEDIATELY (before payment flow)
    if (paidAmount > 0 && app.globalData.userInfo) {
      app.globalData.userInfo.total_spent = (app.globalData.userInfo.total_spent || 0) + paidAmount;
    }

    pay.payOrder(id).then((result) => {
      wx.showToast({ title: '支付成功！', icon: 'success' });
      this.fetchOrders();
      // If server hasn't confirmed callback yet, refresh again after delay
      if (result && result.status === 'pending') {
        setTimeout(() => { this.fetchOrders(); }, 3000);
      }
    }).catch((err) => {
      if (!err.cancelled) {
        // Revert optimistic update on payment failure
        if (paidAmount > 0 && app.globalData.userInfo) {
          app.globalData.userInfo.total_spent = Math.max(0, (app.globalData.userInfo.total_spent || 0) - paidAmount);
        }
        wx.showToast({ title: '支付失败，请重试', icon: 'none' });
      } else {
        // User cancelled — revert optimistic update
        if (paidAmount > 0 && app.globalData.userInfo) {
          app.globalData.userInfo.total_spent = Math.max(0, (app.globalData.userInfo.total_spent || 0) - paidAmount);
        }
      }
    });
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
