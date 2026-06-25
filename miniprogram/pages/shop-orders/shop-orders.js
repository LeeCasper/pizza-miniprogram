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
    this.setData(getSimpleTopBar(app.globalData.statusBarHeight));
  },

  onShow() {
    this.fetchOrders();
  },

  fetchOrders() {
    this.setData({ loading: true });
    const status = this.data.currentTab;
    api.get('/shop/orders', { status }).then(res => {
      if (res.code === 0 && res.data) {
        this.setData({ orders: res.data.list || [], loading: false });
      } else {
        this.setData({ orders: [], loading: false });
      }
    }).catch(() => {
      this.setData({ orders: [], loading: false });
    });
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
