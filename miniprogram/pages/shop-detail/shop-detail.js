// pages/shop-detail/shop-detail.js — 商品详情（Stitch 设计稿 1:1 还原）
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

    // Hero 轮播
    currentImageIndex: 0,

    // 规格选择
    sizeOptions: ['9寸(标准)', '6寸(迷你)'],
    selectedSize: 0,
    crustOptions: ['经典手拍', '薄脆'],
    selectedCrust: 0,
    quantity: 1,

    // Tab 切换
    activeTab: 'detail', // detail | ingredients | reviews

    // 结账抽屉
    checkoutOpen: false,
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
    // 计算滚动区高度：窗口高度 − 顶栏 − 底栏(约 140rpx)
    const win = wx.getWindowInfo();
    const rpx = win.windowWidth / 750;
    const bottomBarPx = 140 * rpx;
    // padding-top 已处理顶栏偏移，高度只需减底栏
    const scrollViewHeight = win.windowHeight - bottomBarPx;
    this.setData({ ...layout, scrollViewHeight });

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
    if (wx.getStorageSync('_manualLogout')) {
      this.setData({ product: null, images: [], loading: false });
      return;
    }
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
        this.updateTotalPrice();
      } else {
        this.setData({ loading: false });
        wx.showToast({ title: '商品不存在', icon: 'none' });
      }
    }).catch(() => {
      this.setData({ loading: false });
    });
  },

  onBack() { wx.navigateBack(); },

  onMore() {
    wx.showActionSheet({
      itemList: ['分享', '举报'],
      success(res) {
        // 预留
      }
    });
  },

  // ── Hero 轮播 ──
  onHeroSwiperChange(e) {
    this.setData({ currentImageIndex: e.detail.current });
  },

  // ── 收藏 ──
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

  // ── 规格选择 ──
  onSizeSelect(e) {
    this.setData({ selectedSize: parseInt(e.currentTarget.dataset.index) });
  },

  onCrustSelect(e) {
    this.setData({ selectedCrust: parseInt(e.currentTarget.dataset.index) });
  },

  // ── 数量 ──
  onQtyMinus() {
    if (this.data.quantity > 1) {
      this.setData({ quantity: this.data.quantity - 1 });
      this.updateTotalPrice();
    }
  },

  onQtyPlus() {
    const p = this.data.product;
    const max = (p && p.stock >= 0) ? Math.min(p.stock, 99) : 99;
    if (this.data.quantity < max) {
      this.setData({ quantity: this.data.quantity + 1 });
      this.updateTotalPrice();
    }
  },

  // ── 配送信息 ──
  onDeliveryTap() {
    wx.showToast({ title: '配送信息', icon: 'none' });
  },

  // ── Tab 切换 ──
  onTabChange(e) {
    this.setData({ activeTab: e.currentTarget.dataset.tab });
  },

  // ── 客服 ──
  onContactService() {
    wx.showToast({ title: '请联系客服', icon: 'none' });
  },

  // ── 加入购物车 ──
  onAddToCart() {
    const p = this.data.product;
    if (!p) return;
    const sizeName = this.data.sizeOptions[this.data.selectedSize];
    const crustName = this.data.crustOptions[this.data.selectedCrust];
    const qty = this.data.quantity;

    // 添加到全局购物车（兼容现有 cart 结构）
    const app = getApp();
    if (!app.globalData.shopCart) app.globalData.shopCart = {};
    const cartKey = p.id + '_' + this.data.selectedSize + '_' + this.data.selectedCrust;
    const existing = app.globalData.shopCart[cartKey];
    app.globalData.shopCart[cartKey] = {
      productId: p.id,
      name: p.name,
      mainImage: p.main_image,
      price: p.price,
      size: sizeName,
      crust: crustName,
      sizeIndex: this.data.selectedSize,
      crustIndex: this.data.selectedCrust,
      quantity: existing ? existing.quantity + qty : qty,
    };

    wx.showToast({ title: '已加入购物车', icon: 'success' });
    this.setData({ quantity: 1 });
  },

  // ── 立即购买 → 打开结账抽屉 ──
  onBuy() {
    const p = this.data.product;
    if (!p) return;
    this.setData({
      checkoutOpen: true,
      paymentMethod: 'wechat',
      submitting: false,
    });
    this.updateTotalPrice();
  },

  onCloseCheckout() {
    this.setData({ checkoutOpen: false });
  },

  updateTotalPrice() {
    const { product, quantity, paymentMethod, submitting } = this.data;
    const price = product ? product.price : 0;
    const total = (price * quantity).toFixed(2);
    const label = paymentMethod === 'balance' ? '余额支付' : '微信支付';
    this.setData({
      totalPrice: total,
      submitBtnText: submitting ? '提交中…' : (label + ' ¥' + total),
    });
  },

  onPaymentMethodChange(e) {
    this.setData({ paymentMethod: e.currentTarget.dataset.method });
    this.updateTotalPrice();
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
    this.updateTotalPrice();

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
        wx.showToast({ title: '支付成功', icon: 'success' });
        setTimeout(() => {
          wx.redirectTo({ url: '/pages/shop-order-detail/shop-order-detail?id=' + order.id });
        }, 800);
      } else {
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
