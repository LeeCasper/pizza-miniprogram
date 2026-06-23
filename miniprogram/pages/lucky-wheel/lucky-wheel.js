const { api } = require('../../utils/api');
const { getSimpleTopBar } = require('../../utils/layout');

const SOURCE_TEXT = { free: '免费', points: '积分加抽', again: '再来一次' };
const FALLBACK_COLORS = ['#F5C518', '#FFE08A', '#F7B733', '#FFD75E'];

// Static decorative bulb positions around the gold rim (inline style strings)
const BULBS = [
  'top: 6rpx; left: 50%; transform: translateX(-50%);',
  'right: 6rpx; top: 50%; transform: translateY(-50%);',
  'bottom: 6rpx; left: 50%; transform: translateX(-50%);',
  'left: 6rpx; top: 50%; transform: translateY(-50%);',
  'top: 14%; left: 14%;',
  'top: 14%; right: 14%;',
  'bottom: 14%; right: 14%;',
  'bottom: 14%; left: 14%;',
];

Page({
  data: {
    statusBarHeight: 0,
    topBarTotalHeight: 0,
    scrollViewHeight: 0,
    bulbs: BULBS,
    segments: [],
    labels: [],
    wheelBg: '',
    rotation: 0,
    spinning: false,
    enabled: true,
    pointsCost: 0,
    userPoints: 0,
    freeRemaining: 0,
    drawsRemaining: 0,
    showResult: false,
    resultText: '',
    resultBonus: false,
    resultThanks: false,
    showRules: false,
    showRecords: false,
    records: [],
  },

  onLoad() {
    const top = getSimpleTopBar();
    const sys = wx.getSystemInfoSync();
    const scrollViewHeight = sys.windowHeight - top.topBarTotalHeight;
    this.setData({ ...top, scrollViewHeight });
    this.loadConfig();
  },

  onBack() { wx.navigateBack({ delta: 1 }); },
  noop() {},

  loadConfig() {
    api.get('/lucky-wheel/config').then(res => {
      if (!res || res.code !== 0 || !res.data) return;
      const d = res.data;
      const segments = d.segments || [];
      this.setData({
        enabled: d.enabled,
        pointsCost: d.pointsCost,
        userPoints: d.userPoints,
        freeRemaining: d.freeRemaining,
        drawsRemaining: d.drawsRemaining,
        segments,
        wheelBg: this.buildWheelBg(segments),
        labels: this.buildLabels(segments),
      });
      if (!d.enabled) wx.showToast({ title: '转盘暂未开放', icon: 'none' });
    }).catch(() => {});
  },

  buildWheelBg(segments) {
    const n = segments.length;
    if (!n) return '';
    const seg = 360 / n;
    const stops = segments.map((s, i) => {
      const color = s.color || FALLBACK_COLORS[i % FALLBACK_COLORS.length];
      return `${color} ${(i * seg).toFixed(3)}deg ${((i + 1) * seg).toFixed(3)}deg`;
    }).join(', ');
    return `conic-gradient(${stops})`;
  },

  buildLabels(segments) {
    const n = segments.length;
    if (!n) return [];
    const seg = 360 / n;
    return segments.map((s, i) => {
      const center = i * seg + seg / 2;
      return {
        id: s.id,
        name: s.name,
        // rotate to the segment center, push text out toward the rim
        style: `transform: rotate(${center.toFixed(3)}deg) translateY(-200rpx);`,
      };
    });
  },

  onSpin() {
    if (this.data.spinning) return;
    if (!this.data.enabled) { wx.showToast({ title: '转盘暂未开放', icon: 'none' }); return; }
    if (!this.data.segments.length) return;

    if (this.data.freeRemaining > 0) {
      this.doDraw('free');
    } else if (this.data.drawsRemaining <= 0) {
      wx.showToast({ title: '今日次数已用完', icon: 'none' });
    } else if (this.data.userPoints < this.data.pointsCost) {
      wx.showToast({ title: '积分不足', icon: 'none' });
    } else {
      wx.showModal({
        title: '加抽确认',
        content: `本次将消耗 ${this.data.pointsCost} 积分，确定吗？`,
        confirmColor: '#C0563A',
        success: r => { if (r.confirm) this.doDraw('points'); },
      });
    }
  },

  doDraw(source) {
    this.setData({ spinning: true });
    api.post('/lucky-wheel/draw', { source }).then(res => {
      if (!res || res.code !== 0 || !res.data) { this.setData({ spinning: false }); return; }
      const d = res.data;
      const winIndex = this.data.segments.findIndex(s => s.id === d.prizeId);
      if (winIndex < 0) { this.setData({ spinning: false }); return; }
      this.spinTo(winIndex, d);
    }).catch(() => { this.setData({ spinning: false }); });
  },

  spinTo(winIndex, result) {
    const n = this.data.segments.length;
    const seg = 360 / n;
    const center = winIndex * seg + seg / 2;
    const targetMod = (360 - (center % 360) + 360) % 360; // rotation (mod 360) to put center under top pointer
    const current = this.data.rotation;
    const extraSpins = 5;
    let target = Math.floor(current / 360) * 360 + targetMod;
    while (target < current + extraSpins * 360) target += 360;

    this.setData({ rotation: target });
    setTimeout(() => {
      this.setData({
        spinning: false,
        showResult: true,
        resultText: result.awardText,
        resultBonus: !!result.bonusSpin,
        resultThanks: result.type === 'thanks',
        userPoints: result.userPoints,
        freeRemaining: result.freeRemaining,
        drawsRemaining: result.drawsRemaining,
      });
    }, 5100); // matches CSS transition-duration 5s + buffer
  },

  onCloseResult() { this.setData({ showResult: false }); },

  // ── Rules modal ──
  onOpenRules() { this.setData({ showRules: true }); },
  onCloseRules() { this.setData({ showRules: false }); },

  // ── Stats card actions ──
  onGetMore() {
    if (this.data.freeRemaining > 0) {
      wx.showToast({ title: `今日还有 ${this.data.freeRemaining} 次免费抽奖`, icon: 'none' });
    } else if (this.data.drawsRemaining > 0) {
      wx.showToast({ title: `可消耗 ${this.data.pointsCost} 积分加抽一次`, icon: 'none' });
    } else {
      wx.showToast({ title: '今日次数已用完，明天再来~', icon: 'none' });
    }
  },

  onPointsDetail() {
    wx.navigateTo({
      url: '/pages/points/points',
      fail: () => wx.showToast({ title: '暂时无法打开', icon: 'none' }),
    });
  },

  onShareAppMessage() {
    return {
      title: '王姐手工披萨 · 幸运转盘，快来抽大奖！',
      path: '/pages/lucky-wheel/lucky-wheel',
    };
  },

  // ── Records drawer ──
  onOpenRecords() {
    this.setData({ showRecords: true });
    api.get('/lucky-wheel/records').then(res => {
      if (!res || res.code !== 0 || !res.data) return;
      const list = (res.data.list || []).map(r => ({
        id: r.id,
        prizeName: r.prizeName,
        createdAt: r.createdAt,
        sourceText: SOURCE_TEXT[r.source] || r.source,
      }));
      this.setData({ records: list });
    }).catch(() => {});
  },

  onCloseRecords() { this.setData({ showRecords: false }); },
});
