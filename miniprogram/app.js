App({
  onLaunch() {
    const systemInfo = wx.getSystemInfoSync();
    this.globalData.statusBarHeight = systemInfo.statusBarHeight;
  },

  globalData: {
    statusBarHeight: 44,
    cart: {},
    cartCount: 0,
    cartTotal: 0,
    userInfo: {
      name: '乔丹·泰勒',
      avatar: '',
      memberLevel: '黄金会员',
      memberId: '**** **** 8294',
      points: 2450,
      coupons: 4,
      cardCount: 0,
      balance: 24,
      bio: '享受美味每一天'
    },
    notificationEnabled: true,
    settingsPhone: '13888888888'
  },

  // 购物车管理
  addToCart(product, quantity, restrictions) {
    const cart = this.globalData.cart;
    const qty = quantity || 1;
    if (cart[product.id]) {
      cart[product.id].quantity += qty;
      // 合并忌口信息
      if (restrictions && restrictions.length > 0) {
        const existing = cart[product.id].restrictions || [];
        const merged = [...new Set([...existing, ...restrictions])];
        cart[product.id].restrictions = merged;
      }
    } else {
      cart[product.id] = { ...product, quantity: qty };
      if (restrictions && restrictions.length > 0) {
        cart[product.id].restrictions = restrictions;
      }
    }
    this.updateCartData();
  },

  decreaseQuantity(productId) {
    const cart = this.globalData.cart;
    if (!cart[productId]) return;
    if (cart[productId].quantity > 1) {
      cart[productId].quantity--;
    } else {
      delete cart[productId];
    }
    this.updateCartData();
  },

  removeFromCart(productId) {
    delete this.globalData.cart[productId];
    this.updateCartData();
  },

  clearCart() {
    this.globalData.cart = {};
    this.updateCartData();
  },

  updateCartData() {
    const cart = this.globalData.cart;
    let count = 0;
    let total = 0;
    Object.values(cart).forEach(item => {
      count += item.quantity;
      total += item.price * item.quantity;
    });
    this.globalData.cartCount = count;
    this.globalData.cartTotal = total;

    // 通知所有页面更新购物车
    const pages = getCurrentPages();
    pages.forEach(page => {
      if (page.updateCart) {
        page.updateCart();
      }
    });
  }
});
