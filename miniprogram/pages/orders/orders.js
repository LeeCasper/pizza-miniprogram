// pages/orders/orders.js
const { api } = require('../../utils/api');
const pay = require('../../utils/pay');
const { getSimpleTopBar } = require('../../utils/layout');
const { formatOrder } = require('../../utils/orders');
const app = getApp();

Page({
  data: {
    statusBarHeight: 44,
    topBarTotalHeight: 80,
    tabs: [
      { key: 'all', name: '全部' },
      { key: 'waiting', name: '待取餐' },
      { key: 'completed', name: '已完成' },
      { key: 'cancelled', name: '已取消' },
    ],
    activeTab: 'all',
    orders: [],
    filteredOrders: [],
    loading: true,
    // 优惠明细弹窗
    discountPopupOpen: false,
    discountPopupTotal: '0.00',
    discountPopupAmount: '0.00',
    discountPopupPaid: '0.00',
    discountPopupCoupon: '0.00',
    discountPopupTier: '0.00',
  },

  onLoad() {
    this.setData(getSimpleTopBar());
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
    if (wx.getStorageSync('_manualLogout')) {
      this.setData({ orders: [], filteredOrders: [], loading: false });
      return;
    }
    this.setData({ loading: true });
    api.get('/orders').then(res => {
      if (res.code === 0) {
        const ordersWithDigits = (res.data || []).map(formatOrder);
        this.setData({ orders: ordersWithDigits, loading: false });
        this.filterOrders();
            this._scheduleCancelDeadlineRefresh(ordersWithDigits);
      } else {
        this.setData({ loading: false });
      }
    }).catch(() => {
      this.setData({ orders: [], filteredOrders: [], loading: false });
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

  _filterByTab(orders, tabKey) {
    if (tabKey === 'all') return orders;
    if (tabKey === 'waiting') return orders.filter(o => o.status === 'waiting' || o.status === 'preparing');
    return orders.filter(o => o.status === tabKey);
  },

  filterOrders() {
    const { activeTab, orders } = this.data;
    let filtered;
    filtered = this._filterByTab(orders, activeTab);
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
      app.globalData.userInfo.totalSpent = (app.globalData.userInfo.totalSpent || 0) + paidAmount;
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
          app.globalData.userInfo.totalSpent = Math.max(0, (app.globalData.userInfo.totalSpent || 0) - paidAmount);
        }
        wx.showToast({ title: '支付失败，请重试', icon: 'none' });
      } else {
        // User cancelled — revert optimistic update
        if (paidAmount > 0 && app.globalData.userInfo) {
          app.globalData.userInfo.totalSpent = Math.max(0, (app.globalData.userInfo.totalSpent || 0) - paidAmount);
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

  onPickupComplete(e) {
    const { id } = e.currentTarget.dataset;
    wx.showModal({
      title: '确认取餐',
      content: '确认已到店取餐吗？',
      confirmText: '已取餐',
      cancelText: '再等等',
      confirmColor: '#C0563A',
      success: (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '处理中...' });
        api.put('/orders/' + id + '/complete').then(result => {
          wx.hideLoading();
          if (result.code === 0) {
            wx.showToast({ title: '已确认取餐', icon: 'success' });
            this.fetchOrders();
          } else {
            wx.showToast({ title: result.message || '操作失败', icon: 'none' });
            this.fetchOrders();
          }
        }).catch(() => {
          wx.hideLoading();
          wx.showToast({ title: '操作失败', icon: 'none' });
        });
      },
    });
  },

  onCancelOrder(e) {
    const { id, paid } = e.currentTarget.dataset;
    const isPaid = paid === true || paid === 'true';
    const content = isPaid ? '取消后将自动退款到原支付方式，确定取消吗？' : '确定要取消此订单吗？';
    wx.showModal({
      title: '取消订单',
      content,
      success: (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '处理中...' });
        api.put('/orders/' + id + '/cancel').then(result => {
          wx.hideLoading();
          if (result.code === 0) {
            const msg = result.refund
              ? (result.refund.method === 'balance' ? '已取消，退款已到账' : '已取消，微信退款处理中')
              : '订单已取消';
            wx.showToast({ title: msg, icon: 'success', duration: 2000 });
            this.fetchOrders();
          } else {
            wx.showToast({ title: result.message || '取消失败', icon: 'none' });
            this.fetchOrders(); // refresh to update canCancel state
          }
        }).catch(() => {
          wx.hideLoading();
          wx.showToast({ title: '取消失败', icon: 'none' });
        });
      }
    });
  },

  onCancelDisabled() {
    wx.showToast({ title: '下单超过1分钟，无法取消', icon: 'none' });
  },

  /** Auto-refresh when the nearest cancelDeadline expires — inline update canCancel, keep button visible */
  _scheduleCancelDeadlineRefresh(orders) {
    if (this._cancelTimer) { clearTimeout(this._cancelTimer); this._cancelTimer = null; }
    const now = Date.now();
    let nearest = Infinity;
    for (const o of orders) {
      if (o.canCancel && o.cancelDeadline) {
        const dl = new Date(o.cancelDeadline).getTime();
        if (dl > now && dl < nearest) nearest = dl;
      }
    }
    if (nearest < Infinity) {
      this._cancelTimer = setTimeout(() => {
        const orders = this.data.orders.map(o => {
          if (o.canCancel && o.cancelDeadline) {
            const dl = new Date(o.cancelDeadline).getTime();
            if (Date.now() >= dl) return { ...o, canCancel: false };
          }
          return o;
        });
        const { activeTab } = this.data;
        const filtered = this._filterByTab(orders, activeTab);
        this.setData({ orders, filteredOrders: filtered });
          }, nearest - now + 500);
    }
  },

  // ── 优惠明细弹窗 ──
  onShowDiscount(e) {
    const { total, discount, paid, couponDiscount, tierDiscount } = e.currentTarget.dataset;
    this.setData({
      discountPopupOpen: true,
      discountPopupTotal: parseFloat(total).toFixed(2),
      discountPopupAmount: parseFloat(discount).toFixed(2),
      discountPopupPaid: parseFloat(paid).toFixed(2),
      discountPopupCoupon: parseFloat(couponDiscount || 0).toFixed(2),
      discountPopupTier: parseFloat(tierDiscount || 0).toFixed(2),
    });
  },
  onCloseDiscount() {
    this.setData({ discountPopupOpen: false });
  },
});
