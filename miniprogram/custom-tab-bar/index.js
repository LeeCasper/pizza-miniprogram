// custom-tab-bar/index.js
Component({
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/index/index', text: '点单', icon: '/images/tab-menu.png' },
      { pagePath: '/pages/orders/orders', text: '订单', icon: '/images/tab-orders.png' },
      { pagePath: '/pages/member/member', text: '会员', icon: '/images/tab-member.png' },
      { pagePath: '/pages/profile/profile', text: '我的', icon: '/images/tab-profile.png' }
    ]
  },

  methods: {
    switchTab(e) {
      const { index, path } = e.currentTarget.dataset;
      if (this.data.selected === index) return;
      // 立即更新选中态，避免等页面 onShow 再更新造成延迟闪烁
      this.setData({ selected: index });
      wx.switchTab({ url: path });
    }
  }
});
