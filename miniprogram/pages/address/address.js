// pages/address/address.js
const { api } = require('../../utils/api');
const app = getApp();
const { getBackBtnTopBar } = require('../../utils/layout');
const { getThemeStyle, getThemeColor, getNavBarStyle, loadThemeConfig } = require('../../utils/theme');
const _navBg = () => getNavBarStyle().nav;

Page({
  data: {
    themeStyle: getThemeStyle(),
    navBarBg: _navBg(),
    themePrimaryColor: getThemeColor('primary'),
    statusBarHeight: 44,
    topBarTotalHeight: 80,
    mode: 'list',
    editId: null,
    addresses: [],
    form: { name: '', phone: '', region: [], detail: '', tag: '', isDefault: false },
    tagOptions: ['家', '公司', '学校'],
    loading: true,
  },

  onLoad() {
    const { statusBarHeight, topBarTotalHeight } = getBackBtnTopBar();
    this.setData({ statusBarHeight, topBarTotalHeight });
    this.fetchAddresses();
  },

  fetchAddresses() {
    this.setData({ loading: true });
    api.get('/addresses').then(res => {
      if (res.code === 0) {
        const addresses = (res.data || []).map(a => ({
          ...a,
          region: a.region || [a.province, a.city, a.district],
        }));
        this.setData({ addresses, loading: false });
      } else {
        this.setData({ loading: false });
      }
    }).catch(() => {
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    });
  },

  onBack() {
    if (this.data.mode === 'form') {
      this.setData({ mode: 'list', editId: null });
    } else {
      wx.navigateBack();
    }
  },

  // ── 列表操作 ─────────────────────────────────

  onAdd() {
    this.setData({
      editId: null,
      form: {
        name: '', phone: '', region: [], detail: '', tag: '',
        isDefault: this.data.addresses.length === 0
      },
      mode: 'form'
    });
  },

  onEdit(e) {
    const { id } = e.currentTarget.dataset;
    const addr = this.data.addresses.find(a => a.id === id);
    if (!addr) return;
    const region = addr.region || [addr.province || '', addr.city || '', addr.district || ''];
    this.setData({
      editId: id,
      form: {
        name: addr.name,
        phone: addr.phone,
        region: [...region],
        detail: addr.detail,
        tag: addr.tag || '',
        isDefault: addr.isDefault,
      },
      mode: 'form',
    });
  },

  onDelete(e) {
    const { id } = e.currentTarget.dataset;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除该地址吗？',
      success: (res) => {
        if (res.confirm) {
          api.del('/addresses/' + id).then(result => {
            if (result.code === 0) {
              wx.showToast({ title: '已删除', icon: 'success' });
              this.fetchAddresses();
            }
          }).catch(() => {
            wx.showToast({ title: '删除失败', icon: 'none' });
          });
        }
      }
    });
  },

  // ── 表单操作 ─────────────────────────────────

  onFormBack() {
    this.setData({ mode: 'list', editId: null });
  },

  onRegionChange(e) {
    this.setData({ 'form.region': e.detail.value });
  },

  onInputName(e)   { this.setData({ 'form.name': e.detail.value }); },
  onInputPhone(e)  { this.setData({ 'form.phone': e.detail.value }); },
  onInputDetail(e) { this.setData({ 'form.detail': e.detail.value }); },

  onTagSelect(e) {
    const { tag } = e.currentTarget.dataset;
    const current = this.data.form.tag;
    this.setData({ 'form.tag': current === tag ? '' : tag });
  },

  onToggleDefault(e) {
    this.setData({ 'form.isDefault': e.detail.value });
  },

  validateForm(form) {
    if (!form.name.trim()) return '请输入收货人姓名';
    if (!/^1[3-9]\d{9}$/.test(form.phone)) return '请输入正确的手机号';
    if (!form.region.length) return '请选择所在地区';
    if (!form.detail.trim()) return '请输入详细地址';
    return null;
  },

  onSave() {
    const form = this.data.form;
    const error = this.validateForm(form);
    if (error) {
      wx.showToast({ title: error, icon: 'none' });
      return;
    }

    const region = form.region;
    const data = {
      name: form.name,
      phone: form.phone,
      province: region[0] || '',
      city: region[1] || '',
      district: region[2] || '',
      detail: form.detail,
      tag: form.tag,
      isDefault: form.isDefault,
    };

    wx.showLoading({ title: '保存中...' });
    const request = this.data.editId
      ? api.put('/addresses/' + this.data.editId, data)
      : api.post('/addresses', data);

    request.then(res => {
      wx.hideLoading();
      if (res.code === 0) {
        wx.showToast({ title: this.data.editId ? '已保存' : '添加成功', icon: 'success' });
        this.fetchAddresses();
        this.setData({ mode: 'list', editId: null });
      }
    }).catch(() => {
      wx.hideLoading();
      wx.showToast({ title: '保存失败', icon: 'none' });
    });
  },

  onDeleteCurrent() {
    const id = this.data.editId;
    if (!id) return;
    this.onDelete({ currentTarget: { dataset: { id } } });
    this.setData({ mode: 'list', editId: null });
  },

  onShow() {
    // 主题：本页经 navigateTo 打开，晚于 app.js 启动广播，需自加载并应用主题
    loadThemeConfig().then(() => this.applyTheme());
  },

  applyTheme() {
    this.setData({ themeStyle: getThemeStyle(), themePrimaryColor: getThemeColor('primary'), navBarBg: _navBg() });
  },

  noop() {}
});
