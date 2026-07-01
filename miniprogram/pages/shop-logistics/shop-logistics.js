// pages/shop-logistics/shop-logistics.js — 物流追踪（黏土风）
const { api, fixImageUrl } = require('../../utils/api');
const { getBackBtnTopBar } = require('../../utils/layout');

Page({
  data: {
    topBarTotalHeight: 80,
    statusBarHeight: 44,
    orders: [],
    loading: true,
    expandedId: null,
    loadingDetail: false,
  },

  onLoad() {
    this.setData(getBackBtnTopBar());
  },

  onShow() {
    this.fetchOrders();
  },

  fetchOrders() {
    if (wx.getStorageSync('_manualLogout')) {
      this.setData({ orders: [], loading: false, expandedId: null, loadingDetail: false });
      return;
    }
    this.setData({ loading: true });
    api.get('/logistics/orders').then(res => {
      if (res.code === 0 && res.data) {
        const orders = (res.data.list || []).map(o => ({
          ...o,
          items: (o.items || []).map(it => ({
            ...it,
            productImage: fixImageUrl(it.productImage),
          })),
          expanded: false,
          trackingEvents: null,
        }));
        this.setData({ orders, loading: false });
      } else {
        this.setData({ orders: [], loading: false });
      }
    }).catch(() => {
      this.setData({ orders: [], loading: false });
    });
  },

  onBack() { wx.navigateBack(); },

  // Toggle card expansion: fetch full tracking if not already loaded
  onToggleTracking(e) {
    const { id } = e.currentTarget.dataset;
    const orders = this.data.orders;
    const idx = orders.findIndex(o => o.id === id);
    if (idx === -1) return;

    const order = orders[idx];

    // Collapse
    if (order.expanded) {
      orders[idx] = { ...order, expanded: false };
      this.setData({ orders, expandedId: null });
      return;
    }

    // Expand: if already have events, just toggle
    if (order.trackingEvents) {
      orders[idx] = { ...order, expanded: true };
      this.setData({ orders, expandedId: id });
      return;
    }

    // First expand — fetch detail
    this.setData({ loadingDetail: true, expandedId: id });
    api.get('/logistics/track/' + id).then(res => {
      if (res.code === 0 && res.data) {
        orders[idx] = {
          ...order,
          expanded: true,
          trackingEvents: (res.data.events || []).map(ev => ({
            ...ev,
            contextSegments: this.highlightTrackingText(ev.context),
          })),
          trackingStateLabel: res.data.stateLabel,
          isDelivered: res.data.isDelivered,
        };
      } else {
        orders[idx] = { ...order, expanded: true, trackingEvents: [] };
      }
      this.setData({ orders, loadingDetail: false });
    }).catch(() => {
      orders[idx] = { ...order, expanded: true, trackingEvents: [] };
      this.setData({ orders, loadingDetail: false });
      wx.showToast({ title: '查询物流失败', icon: 'none' });
    });
  },

  // Navigate to order detail
  onTapOrder(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({ url: '/pages/shop-order-detail/shop-order-detail?id=' + id });
  },

  // 高亮物流文本中的电话和人名
  highlightTrackingText(text) {
    if (!text) return [];
    const segments = [];
    const phoneRe = /(1[3-9]\d-?\d{4}-?\d{4}|\d{3,4}-\d{7,8})/g;
    const nameRe = /([赵钱孙李周吴郑王冯陈褚卫蒋沈韩杨朱秦尤许何吕施张孔曹严华金魏陶姜戚谢邹喻柏水窦章云苏潘葛奚范彭郎鲁韦昌马苗凤花方俞任袁柳酆鲍史唐费廉岑薛雷贺倪汤滕殷罗毕郝邬安常乐于时傅皮下齐康伍余元卜顾孟平黄和穆萧尹姚邵湛汪祁毛禹狄米贝明臧计伏成戴谈宋茅庞熊纪舒屈项祝董梁杜阮蓝闵席季麻强贾路娄危江童颜郭梅盛林刁钟徐邱骆高夏蔡田樊胡凌霍虞万支柯昝管卢莫经房裘缪干解应宗丁宣贲邓郁单杭洪包诸左石崔吉钮龚程嵇邢滑裴陆荣翁荀羊於惠甄麴家封芮羿储靳汲邴糜松井段富巫乌焦巴弓牧隗山谷车侯宓蓬全郗班仰秋仲伊宫宁仇栾暴甘钭厉戎祖武符刘景詹束龙叶幸司韶郜黎蓟薄印宿白怀蒲邰从鄂索咸籍赖卓蔺屠蒙池乔阴鬱胥能苍双闻莘党翟谭贡劳逄姬申扶堵冉宰郦雍卻璩桑桂濮牛寿通边扈燕冀郏浦尚农温别庄晏柴瞿阎充慕连茹习宦艾鱼容向古易慎戈廖庾终暨居衡步都耿满弘匡国文寇广禄阙东欧殳沃利蔚越夔隆师巩厍聂晁勾敖融冷訾辛阚那简饶空曾毋沙乜养鞠须丰巢关蒯相查后荆红游竺权逯盖益桓公万俟司马上官欧阳夏侯诸葛闻人东方赫连皇甫尉迟公羊澹台公冶宗政濮阳淳于单于太叔申屠公孙仲孙轩辕令狐钟离宇文长孙慕容鲜于闾丘司徒司空丌官司寇仉督子车颛孙端木巫马公西漆雕乐正壤驷公良拓跋夹谷宰父谷梁晋楚闫法汝鄢涂钦段干百里东郭南门呼延归海羊舌微生岳帅缑亢况后有琴梁丘左丘东门西门商牟佘佴伯赏南宫墨哈谯笪年爱阳佟][一-龥]{1,2})(?=[^一-龥]|$)/g;
    let lastIdx = 0;
    let match;
    const matches = [];
    while ((match = phoneRe.exec(text)) !== null) {
      matches.push({ start: match.index, end: match.index + match[0].length, text: match[0], type: 'phone' });
    }
    while ((match = nameRe.exec(text)) !== null) {
      const isInPhone = matches.some(m => m.type === 'phone' && match.index >= m.start && match.index < m.end);
      if (!isInPhone) {
        matches.push({ start: match.index, end: match.index + match[0].length, text: match[0], type: 'name' });
      }
    }
    matches.sort((a, b) => a.start - b.start);
    const merged = [];
    for (const m of matches) {
      if (merged.length === 0 || m.start >= merged[merged.length - 1].end) {
        merged.push(m);
      }
    }
    for (const m of merged) {
      if (m.start > lastIdx) {
        segments.push({ text: text.slice(lastIdx, m.start), type: 'normal' });
      }
      segments.push({ text: m.text, type: m.type });
      lastIdx = m.end;
    }
    if (lastIdx < text.length) {
      segments.push({ text: text.slice(lastIdx), type: 'normal' });
    }
    return segments;
  },
});
