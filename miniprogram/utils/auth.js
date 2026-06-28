// utils/auth.js — 认证相关共享模块
// 统一 logout 逻辑，修复 profile.js 漏清 token 的 bug
const { BASE_URL } = require('./api');

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
                    if (page.updateUserInfo) page.updateUserInfo(app.globalData.userInfo);
                  });
                }
              }
            });
          }
          wx.showToast({ title: '已退出', icon: 'success' });
          const pages = getCurrentPages();
          pages.forEach(page => {
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
