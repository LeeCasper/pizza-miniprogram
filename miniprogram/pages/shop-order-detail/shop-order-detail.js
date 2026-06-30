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

  onUnload() {
    if (this._cancelTimer) { clearInterval(this._cancelTimer); this._cancelTimer = null; }
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
        // 1 分钟取消倒计时（实时更新按钮状态）
        const deadline = new Date(order.createdAt.replace(' ', 'T')).getTime() + 60000;
        order.canCancel = Date.now() < deadline;
        this.setData({ order, loading: false });
        // 启动倒计时，过期后自动切换为禁用态
        if (order.canCancel) {
          this._startCancelTimer(deadline);
        }
      } else {
        this.setData({ loading: false });
        wx.showToast({ title: '订单不存在', icon: 'none' });
      }
    }).catch(() => {
      this.setData({ loading: false });
    });
  },

  /** 取消窗口倒计时：到期后自动将按钮切换为禁用态 */
  _startCancelTimer(deadline) {
    if (this._cancelTimer) clearInterval(this._cancelTimer);
    this._cancelTimer = setInterval(() => {
      if (Date.now() >= deadline) {
        clearInterval(this._cancelTimer);
        this._cancelTimer = null;
        if (this.data.order) {
          this.setData({ 'order.canCancel': false });
        }
      }
    }, 200);
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

  onCancelDisabled() {
    wx.showToast({ title: '下单超过1分钟，无法取消', icon: 'none' });
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

  onRequestRefund() {
    wx.showModal({
      title: '申请退款',
      content: '确定要申请退款吗？款项将原路退回。',
      editable: true,
      placeholderText: '请输入退款原因（选填）',
      success: (res) => {
        if (res.confirm) {
          const reason = res.content || '用户申请退款';
          api.post('/shop/orders/' + this.data.orderId + '/refund', { reason }).then(res => {
            if (res.code === 0) {
              wx.showToast({ title: res.data.message || '退款已提交', icon: 'success' });
              this.fetchOrder();
            } else {
              wx.showToast({ title: res.message || '退款申请失败', icon: 'none' });
            }
          }).catch(() => {
            wx.showToast({ title: '网络异常', icon: 'none' });
          });
        }
      },
    });
  },

  onConfirmReceipt() {
    wx.showModal({
      title: '确认收货',
      content: '确定已收到商品吗？',
      success: (res) => {
        if (res.confirm) {
          api.put('/shop/orders/' + this.data.orderId + '/complete').then(res => {
            if (res.code === 0) {
              wx.showToast({ title: '已确认收货', icon: 'success' });
              this.fetchOrder();
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

  onViewLogistics() {
    wx.navigateTo({ url: '/pages/shop-logistics/shop-logistics' });
  },
});
