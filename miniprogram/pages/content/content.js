// pages/content/content.js
// 通用内容展示页 — 关于我们 / 用户协议 / 隐私政策
const { api } = require('../../utils/api');
const { getBackBtnTopBar } = require('../../utils/layout');

const CONTENT_KEYS = {
  about: 'content_about',
  agreement: 'content_agreement',
  privacy: 'content_privacy',
};

const PAGE_TITLES = {
  about: '关于我们',
  agreement: '用户协议',
  privacy: '隐私政策',
};

Page({
  data: {
    statusBarHeight: 44,
    topBarTotalHeight: 80,
    loading: true,
    content: '',
    pageTitle: '',
  },

  onLoad(options) {
    const type = options.type || 'about';
    const key = CONTENT_KEYS[type];
    this.setData({
      ...getBackBtnTopBar(),
      pageTitle: PAGE_TITLES[type] || '内容',
    });

    // 加载内容
    api.get('/config/content/' + key).then(res => {
      var val = '';
      if (res && res.code === 0 && res.data) {
        val = (res.data.value || '').trim();
      }
      // 去掉完整 HTML 文档的包裹标签
      val = val.replace(/<!DOCTYPE[^>]*>/gi, '');
      val = val.replace(/<html[^>]*>/gi, '').replace(/<\/html>/gi, '');
      val = val.replace(/<head>[\s\S]*?<\/head>/gi, '');
      val = val.replace(/<meta[^>]*>/gi, '');
      val = val.replace(/<body[^>]*>/gi, '').replace(/<\/body>/gi, '');
      // 纯文本换行 → <br>
      if (val && val.indexOf('<') === -1) {
        val = val.replace(/\n/g, '<br>');
      }
      this.setData({ content: val, loading: false });
    }).catch(() => {
      this.setData({ loading: false });
    });
  },

  onBack() {
    wx.navigateBack({ delta: 1 });
  },
});
