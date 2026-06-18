<script setup lang="ts">
import { ref, onMounted, h } from 'vue';
import { useRouter } from 'vue-router';
import { NDataTable, NButton, NTag, NSpace, NImage, NIcon, NSwitch, useDialog } from 'naive-ui';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@vicons/antd';
import type { DataTableColumns } from 'naive-ui';
import { fetchBanners, fetchDeleteBanner, fetchToggleBanner, type Banner } from '@/service/api';

defineOptions({ name: 'BannersList' });

const router = useRouter();
const dialog = useDialog();
const banners = ref<Banner[]>([]);
const loading = ref(false);

const linkTypeMap: Record<string, string> = { product: '商品', none: '无' };

const columns: DataTableColumns<Banner> = [
  { title: '排序', key: 'sortOrder', width: 60, align: 'center' },
  {
    title: '缩略图', key: 'imageUrl', width: 80,
    render(row) {
      return h(NImage, { src: row.imageUrl, width: 56, height: 56, style: { borderRadius: '6px', objectFit: 'cover' } });
    }
  },
  { title: '标题', key: 'title', width: 160 },
  { title: '副标题', key: 'subtitle', width: 160, ellipsis: { tooltip: true } },
  {
    title: '标签', key: 'tag', width: 80,
    render(row) { return row.tag ? h(NTag, { type: 'error', size: 'small', bordered: false }, () => row.tag) : '—'; }
  },
  {
    title: '链接类型', key: 'linkType', width: 80,
    render(row) { return linkTypeMap[row.linkType] || row.linkType; }
  },
  {
    title: '状态', key: 'isActive', width: 80,
    render(row) {
      return h(NSwitch, {
        value: !!row.isActive,
        onUpdateValue: (val: boolean) => handleToggle(row.id!, val),
      });
    }
  },
  {
    title: '操作', key: 'actions', width: 100,
    render(row) {
      return h(NSpace, null, {
        default: () => [
          h(NButton, { size: 'small', quaternary: true, onClick: () => router.push(`/banners/${row.id}/edit`) }, { icon: () => h(NIcon, null, () => h(EditOutlined)) }),
          h(NButton, { size: 'small', quaternary: true, type: 'error', onClick: () => handleDelete(row.id!, row.title) }, { icon: () => h(NIcon, null, () => h(DeleteOutlined)) }),
        ]
      });
    }
  },
];

async function loadBanners() {
  loading.value = true;
  const { data, error } = await fetchBanners();
  if (!error && data) banners.value = data;
  loading.value = false;
}

async function handleToggle(id: number, val: boolean) {
  const { error } = await fetchToggleBanner(id);
  if (error) {
    window.$message?.error('切换状态失败');
    return;
  }
  window.$message?.success(val ? '已启用' : '已禁用');
}

async function handleDelete(id: number, title: string) {
  dialog.warning({
    title: '确认删除',
    content: `确定删除轮播图「${title}」？`,
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
  <div class="banners-list">
    <div class="page-header">
      <h2 class="page-title">轮播图管理</h2>
      <NButton type="primary" @click="router.push('/banners/create')">
        <template #icon><NIcon><PlusOutlined /></NIcon></template>
        新建轮播图
      </NButton>
    </div>
    <NDataTable :columns="columns" :data="banners" :loading="loading" :row-key="(r: Banner) => r.id ?? 0" />
  </div>
</template>

<style scoped>
.banners-list { padding: 4px; }
</style>
