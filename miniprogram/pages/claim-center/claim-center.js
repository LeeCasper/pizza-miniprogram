const { getBackBtnTopBar } = require('../../utils/layout');
const { api } = require('../../utils/api');

const REASON_TEXT = {
  ok: '立即领取',
  out_of_stock: '已领完',
  reach_limit: '已达上限',
  level_too_low: '等级不足',
  not_claimable: '不可领取',
};

Page({
  data: {
    statusBarHeight: 44,
    topBarTotalHeight: 80,
    loading: true,
    coupons: [],
    claiming: 0,
  },

  onLoad() {
    this.setData(getBackBtnTopBar());
    this.loadClaimable();
  },

  loadClaimable() {
    if (wx.getStorageSync('_manualLogout')) {
      this.setData({ coupons: [], loading: false, claiming: 0 });
      return;
    }
    this.setData({ loading: true });
    api.get('/coupons/claimable').then(res => {
      if (res.code === 0) {
        const coupons = (res.data || []).map(c => ({
          ...c,
          btnText: REASON_TEXT[c.reason] || (c.canClaim ? '立即领取' : '不可领取'),
          stockText: c.remainingStock == null ? '不限量' : ('剩' + c.remainingStock + '张'),
        }));
        this.setData({ coupons });
      }
    }).catch(() => {}).then(() => this.setData({ loading: false }));
  },

  onClaim(e) {
    const id = e.currentTarget.dataset.id;
    const target = this.data.coupons.find(c => c.id === id);
    if (!target || !target.canClaim || this.data.claiming) return;
    this.setData({ claiming: id });
    api.post('/coupons/claim', { templateId: id }).then(res => {
      if (res.code === 0) {
        wx.showToast({ title: '领取成功', icon: 'success' });
        this.loadClaimable();
      }
    }).catch(() => {
      // utils/api.js 已在非 2xx 时弹出后端中文原因（如「已被领完」「会员等级不足」），此处不再二次 toast
    }).then(() => this.setData({ claiming: 0 }));
  },

  onBack() {
    wx.navigateBack({ delta: 1 });
  },
});
