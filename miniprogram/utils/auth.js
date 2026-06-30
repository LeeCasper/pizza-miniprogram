// utils/auth.js — 认证相关共享模块
// 统一 logout 逻辑，修复 profile.js 漏清 token 的 bug
const { BASE_URL } = require('./api');

function resetPrivatePageData(page) {
  if (!page || !page.setData || !page.data) return;
  var data = page.data;
  var update = {};
  if ('orders' in data) update.orders = [];
  if ('filteredOrders' in data) update.filteredOrders = [];
  if ('addresses' in data) update.addresses = [];
  if ('favorites' in data) update.favorites = [];
  if ('allCoupons' in data) update.allCoupons = [];
  if ('redeemCoupons' in data) update.redeemCoupons = [];
  if ('redeemFiltered' in data) update.redeemFiltered = [];
  if ('discountCoupons' in data) update.discountCoupons = [];
  if ('discountFiltered' in data) update.discountFiltered = [];
  if ('availableCoupons' in data) update.availableCoupons = [];
  if ('selectedCoupon' in data) update.selectedCoupon = null;
  if ('couponPickerOpen' in data) update.couponPickerOpen = false;
  if ('cartOpen' in data) update.cartOpen = false;
  if ('cartItems' in data) update.cartItems = [];
  if ('cartCount' in data) update.cartCount = 0;
  if ('cartTotal' in data) update.cartTotal = 0;
  if ('records' in data) update.records = [];
  if ('showRecords' in data) update.showRecords = false;
  if ('userPoints' in data) update.userPoints = 0;
  if ('phoneNumber' in data) update.phoneNumber = '未设置';
  if ('loading' in data) update.loading = false;
  if (Object.keys(update).length) page.setData(update);
}

/**
 * 退出登录（带确认弹窗）
 * @returns {Promise<boolean>} 用户是否确认退出
 */
function logout() {
  return new Promise(resolve => {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          // 退出前清空服务端购物车（必须在 token 移除前调用）
          const appPre = getApp();
          if (appPre && appPre.globalData) {
            appPre.globalData.cart = {};
            appPre.globalData.cartCount = 0;
            appPre.globalData.cartTotal = 0;
          }
          // 尝试清空服务端购物车（fire-and-forget，忽略失败）
          const tokenPre = wx.getStorageSync('token');
          if (tokenPre) {
            wx.request({
              url: BASE_URL + '/cart', method: 'DELETE',
              header: { 'Authorization': 'Bearer ' + tokenPre },
              success: () => {},
              fail: () => {},
            });
          }
          wx.removeStorageSync('token');
          wx.removeStorageSync('userInfo');
          // 退出态必须同时清掉会话内/持久化自动登录信号，避免刷新后被恢复
          wx.setStorageSync('_loggedOut', '1');
          wx.setStorageSync('_manualLogout', '1');
          const app = getApp();
          if (app && app.globalData) {
            app.globalData.userInfo = { name: '披萨爱好者', avatar: '', totalSpent: 0, memberLevel: 'silver', memberId: '', points: 0, coupons: 0, cardCount: 0, balance: 0, bio: '享受美味每一天', birthday: null };
            app.globalData.token = '';
            app.globalData._loggedOut = true;
            app.globalData._manualLogout = true;
            app.globalData._qlProtected = null;
            app.globalData._defaultAvatarFromServer = false;
            wx.request({
              url: BASE_URL + '/config/default-avatars',
              method: 'GET',
              success: function (r) {
                if (r.statusCode === 200 && r.data.code === 0 && r.data.data && r.data.data.length > 0 && !app.globalData.userInfo.phone) {
                  var list = r.data.data;
                  app.globalData.userInfo.avatar = list[Math.floor(Math.random() * list.length)];
                  app.globalData._defaultAvatarFromServer = true;
                  var activePages = getCurrentPages();
                  activePages.forEach(page => {
                    resetPrivatePageData(page);
                    if (page.updateUserInfo) page.updateUserInfo(app.globalData.userInfo);
                  });
                }
              }
            });
          }
          wx.showToast({ title: '已退出', icon: 'success' });
          const pages = getCurrentPages();
          pages.forEach(page => {
            resetPrivatePageData(page);
            if (page.updateUserInfo && app && app.globalData) page.updateUserInfo(app.globalData.userInfo);
            if (page.setData) page.setData({ showQuickLogin: false });
          });
        }
        resolve(!!res.confirm);
      }
    });
  });
}

module.exports = { logout };
