// pages/coupons/coupons.js
const { coupons } = require('../../utils/data');
const app = getApp();

Page({
  data: {
    statusBarHeight: 44,
    topBarTotalHeight: 80,
    allCoupons: [],
    // 兑换券
    redeemCoupons: [],
    redeemFiltered: [],
    redeemTab: 'available',
    // 优惠券
    discountCoupons: [],
    discountFiltered: [],
    discountTab: 'available',
    // 主 tab
    activeCategory: 'redeem',
    // 详情弹窗
    detailProduct: null,
    detailOpen: false
  },

  onLoad() {
    const sh = app.globalData.statusBarHeight;
    const sys = wx.getSystemInfoSync();
    const rpx = sys.windowWidth / 750;
    // 顶栏: padding-top(状态栏) + 内容(返回按钮80rpx) + padding-bottom(24rpx)
    const topBarH = sh + 80 * rpx + 24 * rpx;
    const redeem = coupons.filter(c => c.category === 'redeem');
    const discount = coupons.filter(c => c.category === 'discount');
    const redeemAvail = redeem.filter(c => c.status === 'available');
    const discountAvail = discount.filter(c => c.status === 'available');
    this.setData({
      statusBarHeight: sh,
      topBarTotalHeight: topBarH,
      allCoupons: coupons,
      redeemCoupons: redeem,
      redeemFiltered: redeemAvail,
      discountCoupons: discount,
      discountFiltered: discountAvail
    });
  },

  onBack() {
    wx.navigateBack();
  },

  // 主分类切换（兑换券 / 优惠券）
  onCategoryChange(e) {
    const { key } = e.currentTarget.dataset;
    this.setData({ activeCategory: key });
  },

  // 状态 tab 切换（可用 / 已使用 / 已过期）
  onStatusTab(e) {
    const { key } = e.currentTarget.dataset;
    const cat = this.data.activeCategory;
    const source = cat === 'redeem' ? this.data.redeemCoupons : this.data.discountCoupons;
    let filtered;
    if (key === 'all') {
      filtered = source;
    } else {
      filtered = source.filter(c => c.status === key);
    }
    const tabField = cat === 'redeem' ? 'redeemTab' : 'discountTab';
    const filteredField = cat === 'redeem' ? 'redeemFiltered' : 'discountFiltered';
    this.setData({ [tabField]: key, [filteredField]: filtered });
  },

  // 点击券 → 打开详情
  onCouponTap(e) {
    const { item } = e.currentTarget.dataset;
    this.setData({ detailProduct: item, detailOpen: true });
  },

  onDetailClose() {
    this.setData({ detailOpen: false, detailProduct: null });
  },

  // 兑换券：立即兑换（生成订单）
  onRedeemUse() {
    const item = this.data.detailProduct;
    if (!item || item.status !== 'available') return;
    wx.showModal({
      title: '确认兑换',
      content: `使用「${item.name}」兑换「${item.redeemProduct.name}」？确认后将生成取餐订单。`,
      success: (res) => {
        if (res.confirm) {
          // 标记已使用
          const updateCoupon = (list) => list.map(c => {
            if (c.id === item.id) {
              return { ...c, status: 'used', usedAt: new Date().toLocaleString() };
            }
            return c;
          });
          const newRedeem = updateCoupon(this.data.redeemCoupons);
          const newRedeemF = updateCoupon(this.data.redeemFiltered);
          this.setData({
            redeemCoupons: newRedeem,
            redeemFiltered: newRedeemF,
            detailProduct: { ...item, status: 'used', usedAt: new Date().toLocaleString() },
            detailOpen: false
          });
          wx.showToast({ title: '兑换成功！订单已生成', icon: 'success', duration: 2000 });
        }
      }
    });
  },

  // 优惠券：去使用 → 返回点单页
  onDiscountUse() {
    const item = this.data.detailProduct;
    if (!item || item.status !== 'available') return;
    this.setData({ detailOpen: false, detailProduct: null });
    wx.navigateBack();
  },

  noop() {}
});
