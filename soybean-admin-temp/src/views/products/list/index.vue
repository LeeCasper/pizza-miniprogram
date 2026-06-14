<script setup lang="ts">
import { ref, onMounted, h } from 'vue';
import { useRouter } from 'vue-router';
import { NDataTable, NButton, NTag, NSpace, NImage, NIcon, NSwitch, useDialog } from 'naive-ui';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@vicons/antd';
import type { DataTableColumns } from 'naive-ui';
import { fetchProducts, fetchDeleteProduct, fetchToggleProduct, type AdminProduct } from '@/service/api';

defineOptions({ name: 'ProductList' });

const router = useRouter();
const dialog = useDialog();
const products = ref<AdminProduct[]>([]);
const loading = ref(false);

const columns: DataTableColumns<AdminProduct> = [
  { title: 'ID', key: 'id', width: 60, align: 'center' },
  {
    title: '图片', key: 'image', width: 70,
    render(row) {
      return h(NImage, { src: row.image, width: 44, height: 44, style: { borderRadius: '6px', objectFit: 'cover' } });
    }
  },
  { title: '名称', key: 'name', width: 180 },
  {
    title: '分类', key: 'category_key', width: 100,
    render(row) {
      const map: Record<string, string> = { pizza: '披萨', durian: '榴莲', pineapple: '凤梨酥' };
      return h(NTag, { size: 'small', bordered: false }, () => map[row.category_key] || row.category_key);
    }
  },
  {
    title: '价格', key: 'price', width: 90, align: 'right',
    render(row) { return `¥${Number(row.price).toFixed(2)}`; }
  },
  {
    title: '标签', key: 'tag', width: 70,
    render(row) {
      return row.tag ? h(NTag, { type: 'error', size: 'small', bordered: false }, () => row.tag) : '—';
    }
  },
  {
    title: '状态', key: 'is_available', width: 80,
    render(row) {
      return h(NSwitch, {
        value: !!row.is_available,
        onUpdateValue: (val: boolean) => handleToggle(row.id, val),
      });
    }
  },
  {
    title: '操作', key: 'actions', width: 100,
    render(row) {
      return h(NSpace, null, {
        default: () => [
          h(NButton, { size: 'small', quaternary: true, onClick: () => router.push(`/products/${row.id}/edit`) }, { icon: () => h(NIcon, null, () => h(EditOutlined)) }),
          h(NButton, { size: 'small', quaternary: true, type: 'error', onClick: () => handleDelete(row.id) }, { icon: () => h(NIcon, null, () => h(DeleteOutlined)) }),
        ]
      });
    }
  },
];

async function loadProducts() {
  loading.value = true;
  const { data, error } = await fetchProducts();
  if (!error && data) {
    products.value = data;
  }
  loading.value = false;
}

async function handleToggle(id: number, val: boolean) {
  // Optimistic update: flip local state immediately
  const product = products.value.find(p => p.id === id);
  if (product) product.is_available = val ? 1 : 0;

  const { error } = await fetchToggleProduct(id);
  if (error) {
    // Rollback on failure
    if (product) product.is_available = val ? 0 : 1;
    window.$message?.error('切换状态失败');
    return;
  }
  window.$message?.success(val ? '已上架' : '已下架');
}

async function handleDelete(id: number) {
  dialog.warning({
    title: '确认下架',
    content: '确定下架该商品？下架后用户将不可见。',
    positiveText: '确认下架',
    negativeText: '取消',
    onPositiveClick: async () => {
      const { error } = await fetchDeleteProduct(id);
      if (!error) {
        window.$message?.success('商品已下架');
        loadProducts();
      }
    },
  });
}

onMounted(() => { loadProducts(); });
</script>

<template>
  <div class="product-list">
    <div class="page-header">
      <h2 class="page-title">商品管理</h2>
      <NButton type="primary" @click="router.push('/products/create')">
        <template #icon><NIcon><PlusOutlined /></NIcon></template>
        新建商品
      </NButton>
    </div>
    <NDataTable :columns="columns" :data="products" :loading="loading" :row-key="(r: AdminProduct) => r.id" />
  </div>
</template>

<style scoped>
.product-list { padding: 4px; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.page-title { margin: 0; font-size: 22px; font-weight: 700; }
</style>
