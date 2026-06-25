// pages/shop-detail/shop-detail.js — 会员商城商品详情（不入购物车，可收藏，支持下单）
const { api, fixImageUrl } = require('../../utils/api');
const { getBackBtnTopBar } = require('../../utils/layout');
const { payShopOrder } = require('../../utils/shopPay');

Page({
  data: {
    statusBarHeight: 44,
    topBarTotalHeight: 80,
    productId: null,
    product: null,
    images: [],
    loading: true,
    favLoading: false,

    // 结账抽屉
    checkoutOpen: false,
    quantity: 1,
    recipientName: '',
    recipientPhone: '',
    recipientAddress: '',
    note: '',
    paymentMethod: 'wechat',
    submitting: false,
    totalPrice: '0.00',
    submitBtnText: '微信支付 ¥0.00',
  },

  onLoad(options) {
    const layout = getBackBtnTopBar();
    const reduction = Math.max(layout.statusBarHeight - 40, 0);
    this.setData({
      statusBarHeight: layout.statusBarHeight - reduction,
      topBarTotalHeight: layout.topBarTotalHeight - reduction,
    });
    const id = options.id;
    if (!id) {
      wx.showToast({ title: '商品不存在', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 800);
      return;
    }
    this.setData({ productId: id });
    this.fetchDetail();
  },

  fetchDetail() {
    api.get('/shop/products/' + this.data.productId).then(res => {
      if (res.code === 0 && res.data) {
        const p = res.data;
        const imgs = (Array.isArray(p.images) && p.images.length
          ? p.images
          : (p.main_image ? [p.main_image] : [])
        ).map(u => fixImageUrl(u));
        this.setData({
          product: { ...p, main_image: fixImageUrl(p.main_image) },
          images: imgs,
          loading: false,
        });
      } else {
        this.setData({ loading: false });
        wx.showToast({ title: '商品不存在', icon: 'none' });
      }
    }).catch(() => {
      this.setData({ loading: false });
    });
  },

  onBack() { wx.navigateBack(); },

  onToggleFav() {
    const p = this.data.product;
    if (!p || this.data.favLoading) return;
    const next = !p.isFavorited;
    this.setData({ 'product.isFavorited': next, favLoading: true });
    const req = next
      ? api.post('/shop/favorites/' + p.id)
      : api.del('/shop/favorites/' + p.id);
    req.then(res => {
      if (!res || res.code !== 0) throw new Error('fav failed');
      wx.showToast({ title: next ? '已收藏' : '已取消收藏', icon: 'none' });
    }).catch(() => {
      this.setData({ 'product.isFavorited': !next });
    }).then(() => {
      this.setData({ favLoading: false });
    });
  },

  // ── 结账抽屉 ──

  updateCheckoutSummary() {
    const { product, quantity, paymentMethod, submitting } = this.data;
    const price = product ? product.price : 0;
    const total = (price * quantity).toFixed(2);
    const label = paymentMethod === 'balance' ? '余额支付' : '微信支付';
    this.setData({
      totalPrice: total,
      submitBtnText: submitting ? '提交中…' : (label + ' ¥' + total),
    });
  },

  onBuy() {
    const p = this.data.product;
    if (!p) return;
    // 重置表单
    this.setData({
      checkoutOpen: true,
      quantity: 1,
      paymentMethod: 'wechat',
      submitting: false,
    });
    this.updateCheckoutSummary();
  },

  onCloseCheckout() {
    this.setData({ checkoutOpen: false });
  },

  onQtyMinus() {
    if (this.data.quantity > 1) {
      this.setData({ quantity: this.data.quantity - 1 });
      this.updateCheckoutSummary();
    }
  },

  onQtyPlus() {
    const p = this.data.product;
    const max = (p && p.stock >= 0) ? Math.min(p.stock, 99) : 99;
    if (this.data.quantity < max) {
      this.setData({ quantity: this.data.quantity + 1 });
      this.updateCheckoutSummary();
    }
  },

  onPaymentMethodChange(e) {
    this.setData({ paymentMethod: e.currentTarget.dataset.method });
    this.updateCheckoutSummary();
  },

  onRecipientInput(e) {
    const { field } = e.currentTarget.dataset;
    this.setData({ [`${field}`]: e.detail.value });
  },

  onNoteInput(e) {
    this.setData({ note: e.detail.value });
  },

  onSubmitOrder() {
    const { product, quantity, recipientName, recipientPhone, recipientAddress, paymentMethod, submitting } = this.data;
    if (submitting) return;

    // 校验
    if (!recipientName.trim()) {
      wx.showToast({ title: '请填写收货人姓名', icon: 'none' });
      return;
    }
    if (!/^1\d{10}$/.test(recipientPhone.trim())) {
      wx.showToast({ title: '请填写正确的手机号', icon: 'none' });
      return;
    }
    if (!recipientAddress.trim()) {
      wx.showToast({ title: '请填写收货地址', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    this.updateCheckoutSummary();

    api.post('/shop/orders', {
      productId: product.id,
      quantity,
      recipientName: recipientName.trim(),
      recipientPhone: recipientPhone.trim(),
      recipientAddress: recipientAddress.trim(),
      note: this.data.note.trim() || null,
      paymentMethod,
    }).then(res => {
      if (res.code !== 0) {
        wx.showToast({ title: res.message || '下单失败', icon: 'none' });
        this.setData({ submitting: false });
        return;
      }

      const order = res.data;
      this.setData({ checkoutOpen: false });

      if (paymentMethod === 'balance' || order.paymentStatus === 'paid') {
        // 余额支付已即时完成
        wx.showToast({ title: '支付成功', icon: 'success' });
        setTimeout(() => {
          wx.redirectTo({ url: '/pages/shop-order-detail/shop-order-detail?id=' + order.id });
        }, 800);
      } else {
        // 微信支付：调起支付
        payShopOrder(order.id).then(payResult => {
          if (payResult && payResult.success) {
            wx.showToast({ title: '支付成功', icon: 'success' });
            setTimeout(() => {
              wx.redirectTo({ url: '/pages/shop-order-detail/shop-order-detail?id=' + order.id });
            }, 800);
          } else {
            wx.showToast({ title: '支付未完成，可在订单列表继续支付', icon: 'none' });
            setTimeout(() => {
              wx.redirectTo({ url: '/pages/shop-orders/shop-orders' });
            }, 1200);
          }
        }).catch(() => {
          wx.showToast({ title: '支付未完成，可在订单列表继续支付', icon: 'none' });
          setTimeout(() => {
            wx.redirectTo({ url: '/pages/shop-orders/shop-orders' });
          }, 1200);
        });
      }
    }).catch(() => {
      wx.showToast({ title: '网络异常，请重试', icon: 'none' });
      this.setData({ submitting: false });
    });
  },
});
