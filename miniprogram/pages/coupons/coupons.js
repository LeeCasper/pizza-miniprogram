// pages/coupons/coupons.js
const { api, fixImageUrl } = require('../../utils/api');
const app = getApp();
const { getBackBtnTopBar } = require('../../utils/layout');

Page({
  data: {
    statusBarHeight: 44,
    topBarTotalHeight: 80,
    allCoupons: [],
    redeemCoupons: [],
    redeemFiltered: [],
    redeemTab: 'available',
    redeemAvailableCount: 0,
    discountCoupons: [],
    discountFiltered: [],
    discountTab: 'available',
    discountAvailableCount: 0,
    activeCategory: 'redeem',
    detailProduct: null,
    detailOpen: false,
    loading: true,
  },

  onLoad() {
    const { statusBarHeight, topBarTotalHeight } = getBackBtnTopBar();
    this.setData({ statusBarHeight, topBarTotalHeight });
    this.fetchCoupons();
  },

  fetchCoupons() {
    this.setData({ loading: true });
    api.get('/coupons').then(res => {
      if (res.code === 0) {
        const all = (res.data || []).map(c => {
          if (c.redeemProduct) {
            c.redeemProduct.image = fixImageUrl(c.redeemProduct.image);
          }
          return c;
        });
        const redeem = all.filter(c => c.category === 'redeem');
        const discount = all.filter(c => c.category === 'discount');
        const redeemAvail = redeem.filter(c => c.status === 'available');
        const discountAvail = discount.filter(c => c.status === 'available');
        this.setData({
          allCoupons: all,
          redeemCoupons: redeem,
          redeemFiltered: redeem.filter(c => c.status === this.data.redeemTab),
          redeemAvailableCount: redeemAvail.length,
          discountCoupons: discount,
          discountFiltered: discount.filter(c => c.status === this.data.discountTab),
          discountAvailableCount: discountAvail.length,
          loading: false,
        });
      } else {
        this.setData({ loading: false });
      }
    }).catch(() => {
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    });
  },

  onBack() {
    wx.navigateBack();
  },

  onCategoryChange(e) {
    const { key } = e.currentTarget.dataset;
    this.setData({ activeCategory: key });
  },

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

  onCouponTap(e) {
    const { item } = e.currentTarget.dataset;
    this.setData({ detailProduct: item, detailOpen: true });
  },

  onDetailClose() {
    this.setData({ detailOpen: false, detailProduct: null });
  },

  onRedeemUse() {
    const item = this.data.detailProduct;
    if (!item || item.status !== 'available') return;

    wx.showModal({
      title: '确认兑换',
      content: `使用「${item.name}」${item.redeemProduct ? '兑换「' + item.redeemProduct.name + '」？' : '进行兑换？'}`,
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '兑换中...' });
          api.post('/coupons/' + item.id + '/redeem').then(result => {
            wx.hideLoading();
            if (result.code === 0) {
              this.fetchCoupons();
              this.setData({ detailOpen: false, detailProduct: null });
              wx.showModal({
                title: '兑换成功',
                content: '已生成订单，可在「订单」中查看取餐码。',
                showCancel: false,
                confirmText: '知道了',
              });
            } else {
              wx.showToast({ title: result.message || '兑换失败', icon: 'none' });
            }
          }).catch(() => {
            wx.hideLoading();
            wx.showToast({ title: '兑换失败', icon: 'none' });
          });
        }
      }
    });
  },

  onDiscountUse() {
    const item = this.data.detailProduct;
    if (!item || item.status !== 'available') return;
    this.setData({ detailOpen: false, detailProduct: null });
    wx.navigateBack();
  },

  noop() {}
});
