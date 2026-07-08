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
    detailImages: [],
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

    shopEnabled: true,
    shopNotice: '',

    // 结账抽屉
    checkoutOpen: false,
    addresses: [],
    selectedAddressId: null,
    selectedAddress: null,
    showAddressPicker: false,
    note: '',
    shippingFee: 10,
    paymentMethod: 'wechat',
    submitting: false,
    totalPrice: '0.00',
  },

  onLoad(options) {
    const layout = getBackBtnTopBar();
    const win = wx.getWindowInfo();
    const rpx = win.windowWidth / 750;
    const bottomBarPx = 140 * rpx;
    const scrollViewHeight = win.windowHeight - bottomBarPx;
    this.setData({
      statusBarHeight: layout.statusBarHeight,
      topBarTotalHeight: layout.topBarTotalHeight,
      scrollViewHeight: scrollViewHeight,
    });

    const id = options.id;
    if (!id) {
      wx.showToast({ title: '商品不存在', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 800);
      return;
    }
    this.setData({ productId: id });
    this.checkShopStatus();
    this.fetchAddresses();
  },

  onShow() {
    // 从地址管理页返回后刷新地址列表
    if (this.data.productId) {
      this.fetchAddresses();
    }
  },

  checkShopStatus() {
    api.publicGet('/config/shop').then(res => {
      if (res.code === 0) {
        const enabled = res.data.enabled !== false;
        this.setData({
          shopEnabled: enabled,
          shopNotice: res.data.notice || '会员商城暂时关闭，敬请期待',
        });
        if (enabled) this.fetchDetail();
        else this.setData({ loading: false });
      } else {
        this.fetchDetail();
      }
    }).catch(() => {
      this.fetchDetail();
    });
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
        const detailImgs = (Array.isArray(p.detailImages) && p.detailImages.length
          ? p.detailImages
          : []
        ).map(u => fixImageUrl(u));
        this.setData({
          product: { ...p, main_image: fixImageUrl(p.main_image) },
          images: imgs,
          detailImages: detailImgs,
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
    this.fetchAddresses().then(() => {
      this.setData({
        checkoutOpen: true,
        paymentMethod: 'wechat',
        submitting: false,
      });
      this.updateTotalPrice();
    });
  },

  onCloseCheckout() {
    this.setData({ checkoutOpen: false, showAddressPicker: false });
  },

  updateTotalPrice() {
    const { product, quantity, shippingFee } = this.data;
    const price = product ? product.price : 0;
    const total = (price * quantity + shippingFee).toFixed(2);
    this.setData({ totalPrice: total });
  },

  // ── 收货地址 ──
  fetchAddresses() {
    return api.get('/addresses').then(res => {
      if (res.code === 0 && Array.isArray(res.data)) {
        const list = res.data;
        // 找到默认地址，没有则选第一个
        let selId = this.data.selectedAddressId;
        let selAddr = null;
        if (list.length > 0) {
          const def = list.find(a => a.isDefault);
          if (def) {
            selId = def.id;
            selAddr = def;
          } else if (!selId || !list.find(a => a.id === selId)) {
            selId = list[0].id;
            selAddr = list[0];
          } else {
            selAddr = list.find(a => a.id === selId) || list[0];
          }
        } else {
          selId = null;
          selAddr = null;
        }
        this.setData({
          addresses: list,
          selectedAddressId: selId,
          selectedAddress: selAddr,
        });
      }
    }).catch(() => {});
  },

  onAddressTap() {
    const { addresses } = this.data;
    if (addresses.length > 0) {
      this.setData({ showAddressPicker: true });
    } else {
      wx.navigateTo({ url: '/pages/address/address' });
    }
  },

  onSelectAddress(e) {
    const id = e.currentTarget.dataset.id;
    const addr = this.data.addresses.find(a => a.id === id);
    if (addr) {
      this.setData({
        selectedAddressId: id,
        selectedAddress: addr,
        showAddressPicker: false,
      });
    }
  },

  onCloseAddressPicker() {
    this.setData({ showAddressPicker: false });
  },

  onManageAddresses() {
    this.setData({ showAddressPicker: false });
    wx.navigateTo({ url: '/pages/address/address' });
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
    const { product, quantity, selectedAddress, paymentMethod, submitting } = this.data;
    if (submitting) return;

    if (!selectedAddress) {
      wx.showToast({ title: '请选择收货地址', icon: 'none' });
      return;
    }

    const addr = selectedAddress;
    const fullAddress = (addr.region || []).join(' ') + ' ' + addr.detail;

    this.setData({ submitting: true });
    this.updateTotalPrice();

    api.post('/shop/orders', {
      productId: product.id,
      quantity,
      recipientName: addr.name,
      recipientPhone: addr.phone,
      recipientAddress: fullAddress,
      addressId: addr.id,
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
