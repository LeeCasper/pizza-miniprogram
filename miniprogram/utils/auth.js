// utils/auth.js — 认证相关共享模块
// 统一 logout 逻辑，修复 profile.js 漏清 token 的 bug

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
          // 设置退出标记，阻止 api.js 的 401 自动重登
          wx.setStorageSync('_loggedOut', '1');
          const app = getApp();
          if (app && app.globalData) {
            app.globalData.userInfo = {};
            app.globalData.token = '';
            app.globalData._loggedOut = true;
          }
          wx.showToast({ title: '已退出', icon: 'success' });
        }
        resolve(!!res.confirm);
      }
    });
  });
}

module.exports = { logout };
