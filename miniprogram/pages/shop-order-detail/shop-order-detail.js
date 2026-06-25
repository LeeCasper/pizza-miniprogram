// pages/shop-order-detail/shop-order-detail.js — 商城订单详情
const { api, fixImageUrl } = require('../../utils/api');
const { getBackBtnTopBar } = require('../../utils/layout');
const { payShopOrder } = require('../../utils/shopPay');
const app = getApp();

Page({
  data: {
    topBarTotalHeight: 80,
    statusBarHeight: 44,
    orderId: null,
    order: null,
    loading: true,
    paying: false,
  },

  onLoad(options) {
    this.setData(getBackBtnTopBar());
    const id = options.id;
    if (!id) {
      wx.showToast({ title: '订单不存在', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 800);
      return;
    }
    this.setData({ orderId: id });
    this.fetchOrder();
  },

  fetchOrder() {
    this.setData({ loading: true });
    api.get('/shop/orders/' + this.data.orderId).then(res => {
      if (res.code === 0 && res.data) {
        const order = res.data;
        if (order.items && order.items.length) {
          order.items = order.items.map(it => ({
            ...it,
            productImage: fixImageUrl(it.productImage),
          }));
        }
        this.setData({ order, loading: false });
      } else {
        this.setData({ loading: false });
        wx.showToast({ title: '订单不存在', icon: 'none' });
      }
    }).catch(() => {
      this.setData({ loading: false });
    });
  },

  onBack() { wx.navigateBack(); },

  onPay() {
    const { order, paying } = this.data;
    if (paying || !order) return;
    this.setData({ paying: true });

    payShopOrder(order.id).then(result => {
      if (result && result.success) {
        wx.showToast({ title: '支付成功', icon: 'success' });
        this.fetchOrder();
      } else {
        wx.showToast({ title: '支付未完成', icon: 'none' });
      }
    }).catch(() => {
      wx.showToast({ title: '支付失败', icon: 'none' });
    }).then(() => {
      this.setData({ paying: false });
    });
  },

  onCancel() {
    wx.showModal({
      title: '取消订单',
      content: '确定要取消吗？',
      success: (res) => {
        if (res.confirm) {
          api.put('/shop/orders/' + this.data.orderId + '/cancel').then(res => {
            if (res.code === 0) {
              wx.showToast({ title: '已取消', icon: 'success' });
              this.fetchOrder();
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
