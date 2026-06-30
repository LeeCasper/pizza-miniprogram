// pages/shop-orders/shop-orders.js — 商城订单列表
const { api, fixImageUrl } = require('../../utils/api');
const { getSimpleTopBar } = require('../../utils/layout');
const { payShopOrder } = require('../../utils/shopPay');
const app = getApp();

const STATUS_TABS = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待支付' },
  { key: 'paid', label: '已支付' },
  { key: 'shipped', label: '已发货' },
  { key: 'completed', label: '已完成' },
];

const STATUS_LABELS = {
  pending: '待支付',
  paid: '已支付',
  shipped: '已发货',
  completed: '已完成',
  cancelled: '已取消',
};

Page({
  data: {
    topBarTotalHeight: 80,
    statusBarHeight: 44,
    orders: [],
    loading: true,
    currentTab: 'all',
    tabs: STATUS_TABS,
    payingId: null,
  },

  onLoad() {
    const layout = getSimpleTopBar(app.globalData.statusBarHeight);
    const rpx = wx.getWindowInfo().windowWidth / 750;
    const delta = Math.max(0, 84 * rpx - 36);
    this.setData({ ...layout, topBarTotalHeight: layout.topBarTotalHeight + delta });
  },

  onShow() {
    this.fetchOrders();
  },

  onHide() {
    this._clearCancelTimers();
  },

  onUnload() {
    this._clearCancelTimers();
  },

  _clearCancelTimers() {
    if (this._cancelTimers) {
      Object.values(this._cancelTimers).forEach(t => clearInterval(t));
      this._cancelTimers = {};
    }
  },

  fetchOrders() {
    if (wx.getStorageSync('_manualLogout')) {
      this.setData({ orders: [], loading: false });
      return;
    }
    this._clearCancelTimers();
    this.setData({ loading: true });
    const status = this.data.currentTab;
    api.get('/shop/orders', { status }).then(res => {
      if (res.code === 0 && res.data) {
        const now = Date.now();
        const timers = {};
        const orders = (res.data.list || []).map(o => {
          // 安全解析 MySQL DATETIME 格式（兼容 iOS 微信）
          const deadline = new Date((o.createdAt || '').replace(' ', 'T')).getTime() + 60000;
          const canCancel = now < deadline;
          if (canCancel) {
            timers[o.id] = this._createCancelTimer(o.id, deadline);
          }
          return {
            ...o,
            canCancel,
            items: (o.items || []).map(it => ({
              ...it,
              productImage: fixImageUrl(it.productImage),
            })),
          };
        });
        this._cancelTimers = timers;
        this.setData({ orders, loading: false });
      } else {
        this.setData({ orders: [], loading: false });
      }
    }).catch(() => {
      this.setData({ orders: [], loading: false });
    });
  },

  /** 为单个订单启动取消窗口倒计时，到期自动切换为禁用态 */
  _createCancelTimer(orderId, deadline) {
    return setInterval(() => {
      if (Date.now() >= deadline) {
        const orders = this.data.orders.map(o => {
          if (o.id === orderId) return { ...o, canCancel: false };
          return o;
        });
        this.setData({ orders });
        if (this._cancelTimers && this._cancelTimers[orderId]) {
          clearInterval(this._cancelTimers[orderId]);
          delete this._cancelTimers[orderId];
        }
      }
    }, 200);
  },

  onBack() { wx.navigateBack(); },

  onTabChange(e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab === this.data.currentTab) return;
    this.setData({ currentTab: tab });
    this.fetchOrders();
  },

  onTapOrder(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({ url: '/pages/shop-order-detail/shop-order-detail?id=' + id });
  },

  onPayOrder(e) {
    const { id } = e.currentTarget.dataset;
    if (this.data.payingId) return;
    this.setData({ payingId: id });

    payShopOrder(id).then(result => {
      if (result && result.success) {
        wx.showToast({ title: '支付成功', icon: 'success' });
        this.fetchOrders();
      } else {
        wx.showToast({ title: '支付未完成', icon: 'none' });
      }
    }).catch(() => {
      wx.showToast({ title: '支付失败，请重试', icon: 'none' });
    }).then(() => {
      this.setData({ payingId: null });
    });
  },

  onConfirmReceipt(e) {
    const { id } = e.currentTarget.dataset;
    wx.showModal({
      title: '确认收货',
      content: '确定已收到商品吗？',
      success: (res) => {
        if (res.confirm) {
          api.put('/shop/orders/' + id + '/complete').then(res => {
            if (res.code === 0) {
              wx.showToast({ title: '已确认收货', icon: 'success' });
              this.fetchOrders();
            } else {
              wx.showToast({ title: res.message || '操作失败', icon: 'none' });
            }
          }).catch(() => {
            wx.showToast({ title: '网络异常', icon: 'none' });
          });
        }
      },
    });
  },

  onCancelDisabled() {
    wx.showToast({ title: '下单超过1分钟，无法取消', icon: 'none' });
  },

  onCancelOrder(e) {
    const { id } = e.currentTarget.dataset;
    wx.showModal({
      title: '取消订单',
      content: '确定要取消该订单吗？',
      success: (res) => {
        if (res.confirm) {
          api.put('/shop/orders/' + id + '/cancel').then(res => {
            if (res.code === 0) {
              wx.showToast({ title: '已取消', icon: 'success' });
              this.fetchOrders();
            } else {
              wx.showToast({ title: res.message || '取消失败', icon: 'none' });
            }
          }).catch(() => {
            wx.showToast({ title: '网络异常', icon: 'none' });
          });
        }
      },
    });
  },
});
