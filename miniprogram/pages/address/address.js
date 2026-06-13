// pages/address/address.js
const { addresses } = require('../../utils/data');
const app = getApp();

Page({
  data: {
    statusBarHeight: 44,
    topBarTotalHeight: 80,
    // 模式: list | form
    mode: 'list',
    editId: null,
    // 地址列表
    addresses: [],
    // 表单数据
    form: { name: '', phone: '', region: [], detail: '', tag: '', isDefault: false },
    // 标签选项
    tagOptions: ['家', '公司', '学校']
  },

  onLoad() {
    const sh = app.globalData.statusBarHeight;
    const sys = wx.getSystemInfoSync();
    const rpx = sys.windowWidth / 750;
    const topBarH = sh + 80 * rpx + 24 * rpx;
    this.setData({
      statusBarHeight: sh,
      topBarTotalHeight: topBarH,
      addresses: addresses.map(a => ({ ...a, region: [...a.region] }))
    });
  },

  onBack() {
    if (this.data.mode === 'form') {
      this.setData({ mode: 'list', editId: null });
    } else {
      wx.navigateBack();
    }
  },

  // ========== 列表操作 ==========

  // 新增地址
  onAdd() {
    this.setData({
      editId: null,
      form: {
        name: '',
        phone: '',
        region: [],
        detail: '',
        tag: '',
        isDefault: this.data.addresses.length === 0
      },
      mode: 'form'
    });
  },

  // 编辑地址
  onEdit(e) {
    const { id } = e.currentTarget.dataset;
    const addr = this.data.addresses.find(a => a.id === id);
    if (!addr) return;
    this.setData({
      editId: id,
      form: {
        name: addr.name,
        phone: addr.phone,
        region: [...addr.region],
        detail: addr.detail,
        tag: addr.tag,
        isDefault: addr.isDefault
      },
      mode: 'form'
    });
  },

  // 删除地址（列表卡片上的删除按钮）
  onDelete(e) {
    const { id } = e.currentTarget.dataset;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除该地址吗？',
      success: (res) => {
        if (res.confirm) {
          const list = this.data.addresses.filter(a => a.id !== id);
          // 如果删除的是默认地址，把第一个设为默认
          if (list.length > 0 && !list.some(a => a.isDefault)) {
            list[0].isDefault = true;
          }
          this.setData({ addresses: list });
          wx.showToast({ title: '已删除', icon: 'success' });
        }
      }
    });
  },

  // ========== 表单操作 ==========

  // 返回列表（不保存）
  onFormBack() {
    this.setData({ mode: 'list', editId: null });
  },

  // 地区选择
  onRegionChange(e) {
    this.setData({ 'form.region': e.detail.value });
  },

  // 输入字段
  onInputName(e)   { this.setData({ 'form.name': e.detail.value }); },
  onInputPhone(e)  { this.setData({ 'form.phone': e.detail.value }); },
  onInputDetail(e) { this.setData({ 'form.detail': e.detail.value }); },

  // 标签选择（家/公司/学校）
  onTagSelect(e) {
    const { tag } = e.currentTarget.dataset;
    const current = this.data.form.tag;
    this.setData({ 'form.tag': current === tag ? '' : tag });
  },

  // 默认地址切换
  onToggleDefault(e) {
    this.setData({ 'form.isDefault': e.detail.value });
  },

  // 表单校验
  validateForm(form) {
    if (!form.name.trim()) return '请输入收货人姓名';
    if (!/^1[3-9]\d{9}$/.test(form.phone)) return '请输入正确的手机号';
    if (!form.region.length) return '请选择所在地区';
    if (!form.detail.trim()) return '请输入详细地址';
    return null;
  },

  // 保存
  onSave() {
    const form = this.data.form;
    const error = this.validateForm(form);
    if (error) {
      wx.showToast({ title: error, icon: 'none' });
      return;
    }

    let list = [...this.data.addresses];

    if (this.data.editId) {
      // 编辑模式：更新已有地址
      list = list.map(a => {
        if (a.id === this.data.editId) {
          return { ...a, ...form, region: [...form.region] };
        }
        return a;
      });
    } else {
      // 新增模式
      const newAddr = {
        id: 'addr_' + Date.now().toString(36),
        ...form,
        region: [...form.region]
      };
      list.push(newAddr);
    }

    // 默认地址唯一性：如果当前设为默认，取消其他默认
    if (form.isDefault) {
      list.forEach(a => { a.isDefault = false; });
      const targetId = this.data.editId || list[list.length - 1].id;
      const target = list.find(a => a.id === targetId);
      if (target) target.isDefault = true;
    } else {
      // 确保至少有一个默认地址
      if (!list.some(a => a.isDefault) && list.length > 0) {
        list[0].isDefault = true;
      }
    }

    this.setData({ addresses: list, mode: 'list', editId: null });
    wx.showToast({ title: this.data.editId ? '已保存' : '添加成功', icon: 'success' });
  },

  // 表单内删除
  onDeleteCurrent() {
    const id = this.data.editId;
    if (!id) return;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除该地址吗？',
      success: (res) => {
        if (res.confirm) {
          let list = this.data.addresses.filter(a => a.id !== id);
          if (list.length > 0 && !list.some(a => a.isDefault)) {
            list[0].isDefault = true;
          }
          this.setData({ addresses: list, mode: 'list', editId: null });
          wx.showToast({ title: '已删除', icon: 'success' });
        }
      }
    });
  },

  noop() {}
});
