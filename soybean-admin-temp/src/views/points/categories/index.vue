<script setup lang="ts">
import { ref, onMounted } from 'vue';
import {
  NButton, NCard, NDataTable, NForm, NFormItem, NInput, NInputNumber,
  NModal, NPopconfirm, NSpace, NSwitch, useMessage,
} from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import {
  fetchPointsCategories, fetchCreatePointsCategory,
  fetchUpdatePointsCategory, fetchDeletePointsCategory,
} from '@/service/api';
import type { PointsCategory } from '@/service/api';

defineOptions({ name: 'PointsCategories' });

const message = useMessage();
const loading = ref(false);
const categories = ref<PointsCategory[]>([]);

// Modal for add/edit
const modalOpen = ref(false);
const modalTitle = ref('新建分类');
const editingKey = ref<string | null>(null);
const form = ref({ key: '', name: '', icon: '', sortOrder: 0, isActive: 1 });

const columns: DataTableColumns<PointsCategory> = [
  { title: '标识', key: 'key', width: 140, ellipsis: { tooltip: true } },
  { title: '名称', key: 'name', width: 140 },
  { title: '图标', key: 'icon', width: 120, ellipsis: { tooltip: true } },
  { title: '排序', key: 'sort_order', width: 80 },
  {
    title: '启用', key: 'is_active', width: 80,
    render: (row) => row.is_active ? '是' : '否',
  },
  {
    title: '操作', key: 'actions', width: 180,
    render: (row) => h(NSpace, null, {
      default: () => [
        h(NButton, { size: 'tiny', onClick: () => openEdit(row) }, { default: () => '编辑' }),
        h(NPopconfirm, { onPositiveClick: () => handleDelete(row.key) }, {
          trigger: () => h(NButton, { size: 'tiny', type: 'error' }, { default: () => '删除' }),
          default: () => '确定删除此分类？',
        }),
      ],
    }),
  },
] as any;

function h(tag: any, props: any, children: any): any {
  return { tag, props, children };
}

onMounted(() => fetchData());

async function fetchData() {
  loading.value = true;
  const { data, error } = await fetchPointsCategories();
  if (!error && data) categories.value = data;
  loading.value = false;
}

function openCreate() {
  editingKey.value = null;
  modalTitle.value = '新建分类';
  form.value = { key: '', name: '', icon: '', sortOrder: 0, isActive: 1 };
  modalOpen.value = true;
}

function openEdit(row: PointsCategory) {
  editingKey.value = row.key;
  modalTitle.value = '编辑分类';
  form.value = {
    key: row.key,
    name: row.name,
    icon: row.icon || '',
    sortOrder: row.sort_order || 0,
    isActive: row.is_active,
  };
  modalOpen.value = true;
}

async function handleSave() {
  if (!form.value.key || !form.value.name) {
    message.warning('请填写分类标识和名称');
    return;
  }
  if (!editingKey.value) {
    const { error } = await fetchCreatePointsCategory({
      key: form.value.key,
      name: form.value.name,
      icon: form.value.icon || undefined,
      sortOrder: form.value.sortOrder,
      isActive: form.value.isActive,
    });
    if (error) return;
    message.success('分类已创建');
  } else {
    const { error } = await fetchUpdatePointsCategory(editingKey.value, {
      name: form.value.name,
      icon: form.value.icon || undefined,
      sortOrder: form.value.sortOrder,
      isActive: form.value.isActive,
    });
    if (error) return;
    message.success('分类已更新');
  }
  modalOpen.value = false;
  fetchData();
}

async function handleDelete(key: string) {
  const { error } = await fetchDeletePointsCategory(key);
  if (!error) {
    message.success('已删除');
    fetchData();
  }
}
</script>

<template>
  <NCard title="积分商城分类" :bordered="false" size="small" class="card-wrapper">
    <template #header-extra>
      <NButton type="primary" size="small" @click="openCreate">新建分类</NButton>
    </template>
    <NDataTable :columns="columns" :data="categories" :loading="loading" :bordered="false" size="small" />
  </NCard>

  <NModal v-model:show="modalOpen" :title="modalTitle" preset="card" style="width: 480px">
    <NForm label-placement="left" label-width="80">
      <NFormItem label="标识" required>
        <NInput v-model:value="form.key" placeholder="小写字母+数字+下划线" :disabled="!!editingKey" />
      </NFormItem>
      <NFormItem label="名称" required>
        <NInput v-model:value="form.name" placeholder="分类名称" />
      </NFormItem>
      <NFormItem label="图标URL">
        <NInput v-model:value="form.icon" placeholder="图标地址（可选）" />
      </NFormItem>
      <NFormItem label="排序">
        <NInputNumber v-model:value="form.sortOrder" :min="0" style="width:100%" />
      </NFormItem>
      <NFormItem label="启用">
        <NSwitch :value="!!form.isActive" @update:value="(v: boolean) => (form.isActive = v ? 1 : 0)" />
      </NFormItem>
    </NForm>
    <template #footer>
      <NSpace justify="end">
        <NButton @click="modalOpen = false">取消</NButton>
        <NButton type="primary" @click="handleSave">保存</NButton>
      </NSpace>
    </template>
  </NModal>
</template>
