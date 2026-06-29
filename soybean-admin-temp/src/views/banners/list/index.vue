<script setup lang="ts">
import { ref, onMounted, h } from 'vue';
import { useRouter } from 'vue-router';
import { NCard, NDataTable, NButton, NTag, NSpace, NImage, NIcon, NSwitch, NSelect, useDialog } from 'naive-ui';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@vicons/antd';
import type { DataTableColumns } from 'naive-ui';
import { fetchBanners, fetchDeleteBanner, fetchToggleBanner, type Banner } from '@/service/api';

defineOptions({ name: 'BannersList' });

const router = useRouter();
const dialog = useDialog();
const banners = ref<Banner[]>([]);
const loading = ref(false);

const scopeFilter = ref<string | null>(null);
const scopeFilterOptions = [
  { label: '全部', value: null },
  { label: '点单页', value: 'pos' },
  { label: '商城页', value: 'shop' },
  { label: '两处', value: 'both' },
];
const scopeMap: Record<string, string> = { pos: '点单', shop: '商城', both: '两处' };
const linkTypeMap: Record<string, string> = {
  product: '商品', none: '无', coupon: '优惠券', points: '积分',
  'lucky-wheel': '幸运转盘', url: '外链',
};

const columns: DataTableColumns<Banner> = [
  { title: '排序', key: 'sortOrder', width: 60, align: 'center' },
  {
    title: '缩略图', key: 'imageUrl', width: 80,
    render(row) {
      return h(NImage, { src: row.imageUrl, width: 56, height: 56, style: { borderRadius: '6px', objectFit: 'cover' } });
    }
  },
  {
    title: '链接类型', key: 'linkType', width: 80,
    render(row) { return linkTypeMap[row.linkType] || row.linkType; }
  },
  {
    title: '展示范围', key: 'scope', width: 80,
    render(row) {
      return h(NTag, { type: row.scope === 'both' ? 'info' : row.scope === 'shop' ? 'success' : 'default', size: 'small', bordered: false }, () => scopeMap[row.scope] || row.scope || '点单');
    }
  },
  {
    title: '状态', key: 'isActive', width: 80,
    render(row) {
      return h(NSwitch, {
        value: !!row.isActive,
        onUpdateValue: (val: boolean) => handleToggle(row, val),
      });
    }
  },
  {
    title: '操作', key: 'actions', width: 100,
    render(row) {
      return h(NSpace, null, {
        default: () => [
          h(NButton, { size: 'small', quaternary: true, onClick: () => router.push(`/banners/${row.id}/edit`) }, { icon: () => h(NIcon, null, () => h(EditOutlined)) }),
          h(NButton, { size: 'small', quaternary: true, type: 'error', onClick: () => handleDelete(row.id!) }, { icon: () => h(NIcon, null, () => h(DeleteOutlined)) }),
        ]
      });
    }
  },
];

async function loadBanners() {
  loading.value = true;
  const { data, error } = await fetchBanners();
  if (!error && data) {
    let filtered = data;
    if (scopeFilter.value) {
      filtered = data.filter(b => b.scope === scopeFilter.value || b.scope === 'both');
    }
    banners.value = filtered;
  }
  loading.value = false;
}

async function handleToggle(row: Banner, val: boolean) {
  const { data, error } = await fetchToggleBanner(row.id!);
  if (error) {
    window.$message?.error('切换状态失败');
    return;
  }
  row.isActive = data?.isActive ?? val;
  window.$message?.success(val ? '已启用' : '已禁用');
}

async function handleDelete(id: number) {
  dialog.warning({
    title: '确认删除',
    content: '确定删除该轮播图？',
    positiveText: '确认删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      const { error } = await fetchDeleteBanner(id);
      if (!error) {
        window.$message?.success('轮播图已删除');
        loadBanners();
      }
    },
  });
}

onMounted(() => { loadBanners(); });
</script>

<template>
  <NCard title="轮播图管理" :bordered="false" class="card-wrapper">
    <template #header-extra>
      <NSpace>
        <NSelect
          v-model:value="scopeFilter"
          :options="scopeFilterOptions"
          placeholder="展示范围"
          clearable
          style="width: 140px"
          @update:value="loadBanners"
        />
        <NButton type="primary" @click="router.push('/banners/create')">
        <template #icon><NIcon><PlusOutlined /></NIcon></template>
        新建轮播图
        </NButton>
      </NSpace>
    </template>
    <NDataTable :columns="columns" :data="banners" :loading="loading" :row-key="(r: Banner) => r.id ?? 0" />
  </NCard>
</template>

<style scoped></style>
