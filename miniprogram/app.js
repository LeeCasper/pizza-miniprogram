const { doLogin, api, fixImageUrl } = require('./utils/api');
const { loadThemeConfig, buildThemeStyle, getThemeStyle } = require('./utils/theme');

App({
  onLaunch() {
    const windowInfo = wx.getWindowInfo();
    this.globalData.statusBarHeight = windowInfo.statusBarHeight;

    // 异步加载主题配置（不阻塞启动）
    loadThemeConfig().then(cfg => {
      this.globalData.themeStyle = getThemeStyle();
      this.globalData.themeConfig = cfg;
      // 通知已加载的页面刷新主题
      const pages = getCurrentPages();
      pages.forEach(p => {
        if (p.applyTheme) p.applyTheme();
      });
    });

    // 尝试自动登录
    const token = wx.getStorageSync('token');
    const cachedUser = wx.getStorageSync('userInfo');
    if (cachedUser) {
      if (cachedUser.avatar) cachedUser.avatar = fixImageUrl(cachedUser.avatar);
      this.globalData.userInfo = cachedUser;
    }

    if (token) {
      // 有 token，验证并刷新用户信息
      api.get('/user/profile').then(res => {
        if (res.code === 0) {
          if (res.data.avatar) res.data.avatar = fixImageUrl(res.data.avatar);
          this.globalData.userInfo = res.data;
          wx.setStorageSync('userInfo', res.data);
        }
      }).catch(() => {
        // Token 无效，重新登录
        this.doAppLogin();
      });
    } else {
      // 首次启动，执行登录
      this.doAppLogin();
    }
  },

  doAppLogin() {
    doLogin().then(user => {
      if (user.avatar) user.avatar = fixImageUrl(user.avatar);
      this.globalData.userInfo = user;
      wx.setStorageSync('userInfo', user);
    }).catch(() => {
      // 登录失败静默处理，使用离线模式
      console.warn('[App] 登录失败，使用离线模式');
    });
  },

  globalData: {
    statusBarHeight: 44,
    cart: {},
    cartCount: 0,
    cartTotal: 0,
    themeStyle: '',
    themeConfig: null,
    userInfo: {
      name: '披萨爱好者',
      avatar: '',
      totalSpent: 0,
      memberLevel: 'silver',
      memberId: '',
      points: 0,
      coupons: 0,
      cardCount: 0,
      balance: 0,
      bio: '享受美味每一天',
      birthday: null
    },
    notificationEnabled: true,
    settingsPhone: ''
  },

  // ── 购物车管理（乐观更新：本地即时响应 + 后台同步）───

  addToCart(product, quantity, restrictions) {
    const cart = this.globalData.cart;
    const qty = quantity || 1;
    if (cart[product.id]) {
      cart[product.id].quantity += qty;
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

    // 后台同步到服务器
    const item = cart[product.id];
    api.post('/cart/items', {
      productId: product.id,
      quantity: item.quantity,
      restrictions: item.restrictions || [],
    }).catch(() => {});
  },

  decreaseQuantity(productId) {
    const cart = this.globalData.cart;
    if (!cart[productId]) return;
    if (cart[productId].quantity > 1) {
      cart[productId].quantity--;
      // 同步
      api.put('/cart/items/' + productId, {
        quantity: cart[productId].quantity,
        restrictions: cart[productId].restrictions || [],
      }).catch(() => {});
    } else {
      delete cart[productId];
      api.del('/cart/items/' + productId).catch(() => {});
    }
    this.updateCartData();
  },

  removeFromCart(productId) {
    delete this.globalData.cart[productId];
    this.updateCartData();
    api.del('/cart/items/' + productId).catch(() => {});
  },

  clearCart() {
    this.globalData.cart = {};
    this.updateCartData();
    api.del('/cart').catch(() => {});
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
