// utils/layout.js — 顶栏高度计算共享模块
// 统一三种顶栏模式，避免 12+ 页面重复内联计算

function getSystemInfo() {
  const win = wx.getWindowInfo();
  return { statusBarHeight: win.statusBarHeight, windowWidth: win.windowWidth, windowHeight: win.windowHeight };
}

/**
 * 简单标题栏：sh + 36
 * 用于 profile, points, store, recharge, orders, index, tiers 等
 * @param {number} [sh] - 可选，传入已知 statusBarHeight 避免重复调用
 */
function getSimpleTopBar(sh) {
  if (sh == null) sh = getSystemInfo().statusBarHeight;
  return { statusBarHeight: sh, topBarTotalHeight: sh + 36 };
}

/**
 * 带返回按钮的顶栏：sh + 80rpx + 24rpx
 * 用于 coupons, address, settings, member
 */
function getBackBtnTopBar() {
  const { statusBarHeight, windowWidth } = getSystemInfo();
  const rpx = windowWidth / 750;
  return { statusBarHeight, topBarTotalHeight: statusBarHeight + 80 * rpx + 24 * rpx };
}

/**
 * 全屏 swiper 布局：含 scrollViewHeight
 * 用于 main, shop
 */
function getSwiperLayout() {
  const { statusBarHeight: sh, windowWidth, windowHeight } = getSystemInfo();
  const rpx = windowWidth / 750;
  const tabBarPx = 100 * rpx;
  const swiperHeight = windowHeight - (sh + 36);
  const scrollViewHeight = swiperHeight - tabBarPx;
  return { statusBarHeight: sh, topBarTotalHeight: sh + 36, scrollViewHeight };
}

module.exports = { getSimpleTopBar, getBackBtnTopBar, getSwiperLayout };
