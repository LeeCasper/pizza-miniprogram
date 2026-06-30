const { doLogin, api, fixImageUrl, BASE_URL } = require('./utils/api');

App({
  onLaunch() {
    const windowInfo = wx.getWindowInfo();
    this.globalData.statusBarHeight = windowInfo.statusBarHeight;

    // 每次冷启动清除退出标记 — _loggedOut 只对当前会话有效，新会话应重试登录
    wx.removeStorageSync('_loggedOut');

    // 预获取默认头像（未登录时展示 CDN 默认头像，替代本地 icon）
    var app = this;
    var cachedUser = wx.getStorageSync('userInfo');
    if (cachedUser) {
      if (cachedUser.avatar) cachedUser.avatar = fixImageUrl(cachedUser.avatar);
      this.globalData.userInfo = { ...this.globalData.userInfo, ...cachedUser };
    }
    wx.request({
      url: BASE_URL + '/config/default-avatars',
      method: 'GET',
      success: function (res) {
        if (res.statusCode === 200 && res.data.code === 0 && res.data.data && res.data.data.length > 0) {
          var list = res.data.data;
          var randomAvatar = list[Math.floor(Math.random() * list.length)];
          if (!app.globalData.userInfo.phone && (!app.globalData.userInfo.avatar || app.globalData._defaultAvatarFromServer)) {
            app.globalData.userInfo.avatar = randomAvatar;
            app.globalData._defaultAvatarFromServer = true;
            console.log('[app] default avatar loaded:', JSON.stringify(randomAvatar));
            var pages = getCurrentPages();
            pages.forEach(function (p) {
              if (p.updateUserInfo) p.updateUserInfo(app.globalData.userInfo);
            });
          }
        }
      }
    });

    if (wx.getStorageSync('_manualLogout')) {
      console.log('[app] manualLogout active — skip auto login');
      return;
    }

    const token = wx.getStorageSync('token');
    // 尝试自动登录（手动退出后禁止自动恢复，直到用户主动重新登录）
    if (token) {
      // 有 token，验证并刷新用户信息
      api.get('/user/profile').then(res => {
        if (res.code === 0) {
          if (res.data.avatar) res.data.avatar = fixImageUrl(res.data.avatar);
          this.globalData.userInfo = res.data;
          wx.setStorageSync('userInfo', res.data);
        }
        this.loadCartFromServer();
      }).catch(() => {
        // Token 无效，重新登录
        this.doAppLogin();
      });
    } else {
      // 无 token，静默登录获取用户数据（头像/昵称等展示用）
      this.doAppLogin();
    }
  },

  doAppLogin() {
    if (wx.getStorageSync('_manualLogout')) {
      console.log('[app] doAppLogin skipped — manualLogout active');
      return;
    }
    doLogin().then(user => {
      console.log('[app] doAppLogin SUCCESS — user.avatar:', JSON.stringify(user.avatar), 'user.phone:', JSON.stringify(user.phone), 'user.name:', JSON.stringify(user.name));
      if (user.avatar) user.avatar = fixImageUrl(user.avatar);
      this.globalData.userInfo = user;
      wx.setStorageSync('userInfo', user);
      // 通知所有活跃页面：用户信息已更新（头像、昵称等立即生效）
      const pages = getCurrentPages();
      pages.forEach(p => {
        if (p.updateUserInfo) p.updateUserInfo(user);
      });
      // 登录成功后从服务端恢复购物车
      this.loadCartFromServer();
    }).catch((e) => {
      // 登录失败静默处理，使用离线模式
      console.warn('[App] 登录失败，使用离线模式', e);
    });
  },

  /** 从服务端加载购物车，防止跨会话本地/服务端不同步 */
  loadCartFromServer() {
    api.get('/cart').then(res => {
      if (res && res.code === 0 && res.data && res.data.items) {
        const cart = {};
        res.data.items.forEach(item => {
          cart[item.productId] = {
            id: item.productId,
            name: item.productName,
            price: item.productPrice,
            image: item.productImage,
            categoryKey: item.categoryKey,
            tag: item.tag,
            sizeDesc: item.sizeDesc,
            quantity: item.quantity,
            restrictions: item.restrictions || [],
          };
        });
        this.globalData.cart = cart;
        // 同步派生数据
        const count = res.data.items.reduce((s, i) => s + i.quantity, 0);
        const total = res.data.items.reduce((s, i) => s + i.productPrice * i.quantity, 0);
        this.globalData.cartCount = count;
        this.globalData.cartTotal = total;
        // 通知所有活跃页面：购物车已更新
        const pages = getCurrentPages();
        pages.forEach(p => {
          if (p.updateCart) p.updateCart();
        });
      }
    }).catch(() => {
      // 加载失败静默处理
    });
  },

  globalData: {
    statusBarHeight: 44,
    cart: {},
    cartCount: 0,
    cartTotal: 0,
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
