<script setup lang="ts">
import { ref, onMounted, h } from 'vue';
import { useRouter } from 'vue-router';
import { NDataTable, NButton, NTag, NSpace, NImage, NIcon, NSwitch, useDialog } from 'naive-ui';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@vicons/antd';
import type { DataTableColumns } from 'naive-ui';
import { fetchPointsProducts, fetchDeletePointsProduct, fetchTogglePointsProduct } from '@/service/api';

defineOptions({ name: 'PointsList' });

const router = useRouter();
const dialog = useDialog();
const products = ref<any[]>([]);
const loading = ref(false);

const columns: DataTableColumns<any> = [
  { title: 'ID', key: 'id', width: 60 },
  {
    title: '图片', key: 'image', width: 60,
    render(row) { return h(NImage, { src: row.image, width: 40, height: 40, style: { borderRadius: '6px', objectFit: 'cover' } }); }
  },
  { title: '名称', key: 'name', width: 160 },
  {
    title: '类型', key: 'redeemType', width: 80,
    render(row) { return row.redeemType === 'coupon' ? '优惠券' : '实物'; }
  },
  { title: '所需积分', key: 'points', width: 90, align: 'right' },
  { title: '库存', key: 'stock', width: 80 },
  {
    title: '标签', key: 'tag', width: 70,
    render(row) { return row.tag ? h(NTag, { type: 'warning', size: 'small', bordered: false }, () => row.tag) : '—'; }
  },
  {
    title: '状态', key: 'isActive', width: 80,
    render(row) {
      return h(NSwitch, {
        value: !!row.isActive,
        onUpdateValue: (val: boolean) => handleToggle(row.id, val),
      });
    }
  },
  {
    title: '操作', key: 'actions', width: 100,
    render(row) {
      return h(NSpace, null, {
        default: () => [
          h(NButton, { size: 'small', quaternary: true, onClick: () => router.push(`/points/${row.id}/edit`) }, { icon: () => h(NIcon, null, () => h(EditOutlined)) }),
          h(NButton, { size: 'small', quaternary: true, type: 'error', onClick: () => handleDelete(row.id, row.name) }, { icon: () => h(NIcon, null, () => h(DeleteOutlined)) }),
        ]
      });
    }
  },
];

async function loadProducts() {
  loading.value = true;
  const { data, error } = await fetchPointsProducts();
  if (!error && data) products.value = data;
  loading.value = false;
}

async function handleToggle(id: number, val: boolean) {
  const { error } = await fetchTogglePointsProduct(id);
  if (error) {
    window.$message?.error('切换状态失败');
    return;
  }
  window.$message?.success(val ? '已启用' : '已禁用');
}

async function handleDelete(id: number, name: string) {
  dialog.warning({
    title: '确认删除',
    content: `确定删除积分商品「${name}」？此操作不可撤销。`,
    positiveText: '确认删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      const { error } = await fetchDeletePointsProduct(id);
      if (!error) {
        window.$message?.success('已下架');
        loadProducts();
      }
    },
  });
}

onMounted(() => { loadProducts(); });
</script>

<template>
  <div class="points-list">
    <div class="page-header">
      <h2 class="page-title">积分商城</h2>
      <NButton type="primary" @click="router.push('/points/create')">
        <template #icon><NIcon><PlusOutlined /></NIcon></template>
        新建积分商品
      </NButton>
    </div>
    <NDataTable :columns="columns" :data="products" :loading="loading" :row-key="(r: any) => r.id" />
  </div>
</template>

<style scoped>
.points-list { padding: 4px; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.page-title { margin: 0; font-size: 22px; font-weight: 700; }
</style>
