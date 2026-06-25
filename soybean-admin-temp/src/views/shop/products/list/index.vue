<script setup lang="ts">
import { h, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { NButton, NCard, NDataTable, NIcon, NImage, NSpace, NSwitch, NTag, useDialog } from 'naive-ui';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@vicons/antd';
import type { DataTableColumns } from 'naive-ui';
import { type AdminShopProduct, fetchDeleteShopProduct, fetchShopCategories, fetchShopProducts, fetchToggleShopProduct } from '@/service/api';
import { formatPrice } from '@/utils/format';

defineOptions({ name: 'ShopProductsList' });

const router = useRouter();
const dialog = useDialog();
const products = ref<AdminShopProduct[]>([]);
const categoryMap = ref<Record<string, string>>({});
const loading = ref(false);

const columns: DataTableColumns<AdminShopProduct> = [
  { title: 'ID', key: 'id', width: 60, align: 'center' },
  {
    title: '图片', key: 'main_image', width: 70,
    render(row) {
      return row.main_image
        ? h(NImage, { src: row.main_image, width: 44, height: 44, style: { borderRadius: '6px', objectFit: 'cover' } })
        : '—';
    }
  },
  { title: '名称', key: 'name', width: 180 },
  {
    title: '分类', key: 'shop_category_key', width: 100,
    render(row) {
      return row.shop_category_key
        ? h(NTag, { size: 'small', bordered: false }, () => categoryMap.value[row.shop_category_key as string] || row.shop_category_key)
        : '—';
    }
  },
  {
    title: '价格', key: 'price', width: 90, align: 'right',
    render(row) { return formatPrice(row.price); }
  },
  { title: '库存', key: 'stock', width: 70, align: 'center' },
  { title: '销量', key: 'sales', width: 70, align: 'center' },
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
          h(NButton, { size: 'small', quaternary: true, onClick: () => router.push(`/shop/products/${row.id}/edit`) }, { icon: () => h(NIcon, null, () => h(EditOutlined)) }),
          h(NButton, { size: 'small', quaternary: true, type: 'error', onClick: () => handleDelete(row.id) }, { icon: () => h(NIcon, null, () => h(DeleteOutlined)) }),
        ]
      });
    }
  },
];

async function loadProducts() {
  loading.value = true;
  const { data, error } = await fetchShopProducts();
  if (!error && data) products.value = data;
  loading.value = false;
}

async function loadCategories() {
  const { data, error } = await fetchShopCategories();
  if (!error && data) {
    const map: Record<string, string> = {};
    data.forEach(c => { map[c.key] = c.name; });
    categoryMap.value = map;
  }
}

async function handleToggle(id: number, val: boolean) {
  const product = products.value.find(p => p.id === id);
  if (product) product.is_available = val ? 1 : 0;
  const { error } = await fetchToggleShopProduct(id);
  if (error) {
    if (product) product.is_available = val ? 0 : 1;
    window.$message?.error('切换状态失败');
    return;
  }
  window.$message?.success(val ? '已上架' : '已下架');
}

async function handleDelete(id: number) {
  dialog.warning({
    title: '确认删除',
    content: '确定删除该商城商品？删除后将从列表移除（订单历史仍保留）。',
    positiveText: '确认删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      const { error } = await fetchDeleteShopProduct(id);
      if (!error) {
        window.$message?.success('商品已删除');
        loadProducts();
      }
    },
  });
}

onMounted(() => { loadProducts(); loadCategories(); });
</script>

<template>
  <NCard title="商城商品" :bordered="false" class="card-wrapper">
    <template #header-extra>
      <NButton type="primary" @click="router.push('/shop/products/create')">
        <template #icon><NIcon><PlusOutlined /></NIcon></template>
        新建商品
      </NButton>
    </template>
    <NDataTable :columns="columns" :data="products" :loading="loading" :row-key="(r: AdminShopProduct) => r.id" />
  </NCard>
</template>

<style scoped></style>
