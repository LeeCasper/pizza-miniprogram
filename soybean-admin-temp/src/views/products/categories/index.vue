<script setup lang="ts">
import { ref, onMounted, reactive, h } from 'vue';
import { NCard, NDataTable, NButton, NSpace, NImage, NIcon, NSwitch, NModal, NForm, NFormItem, NInput, NInputNumber, useDialog } from 'naive-ui';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@vicons/antd';
import type { DataTableColumns } from 'naive-ui';
import { fetchCategories, fetchCreateCategory, fetchUpdateCategory, fetchDeleteCategory, type AdminCategory } from '@/service/api';
import ImageUpload from '@/components/common/ImageUpload.vue';

defineOptions({ name: 'ProductsCategories' });

const dialog = useDialog();
const categories = ref<AdminCategory[]>([]);
const loading = ref(false);

const showModal = ref(false);
const isEdit = ref(false);
const submitting = ref(false);
const form = reactive({
  key: '',
  name: '',
  icon: '',
  sortOrder: 0,
  isActive: true,
});

function resetForm() {
  form.key = '';
  form.name = '';
  form.icon = '';
  form.sortOrder = 0;
  form.isActive = true;
}

function openCreate() {
  isEdit.value = false;
  resetForm();
  showModal.value = true;
}

function openEdit(row: AdminCategory) {
  isEdit.value = true;
  form.key = row.key;
  form.name = row.name;
  form.icon = row.icon || '';
  form.sortOrder = row.sort_order || 0;
  form.isActive = !!row.is_active;
  showModal.value = true;
}

const columns: DataTableColumns<AdminCategory> = [
  { title: '排序', key: 'sort_order', width: 60, align: 'center' },
  { title: '标识 (key)', key: 'key', width: 120 },
  { title: '名称', key: 'name', width: 140 },
  {
    title: '图标', key: 'icon', width: 70,
    render(row) {
      return row.icon
        ? h(NImage, { src: row.icon, width: 40, height: 40, style: { borderRadius: '6px', objectFit: 'cover' } })
        : '—';
    }
  },
  {
    title: '状态', key: 'is_active', width: 80,
    render(row) {
      return h(NSwitch, {
        value: !!row.is_active,
        onUpdateValue: (val: boolean) => handleToggle(row, val),
      });
    }
  },
  {
    title: '操作', key: 'actions', width: 100,
    render(row) {
      return h(NSpace, null, {
        default: () => [
          h(NButton, { size: 'small', quaternary: true, onClick: () => openEdit(row) }, { icon: () => h(NIcon, null, () => h(EditOutlined)) }),
          h(NButton, { size: 'small', quaternary: true, type: 'error', onClick: () => handleDelete(row) }, { icon: () => h(NIcon, null, () => h(DeleteOutlined)) }),
        ]
      });
    }
  },
];

async function loadCategories() {
  loading.value = true;
  const { data, error } = await fetchCategories();
  if (!error && data) categories.value = data;
  loading.value = false;
}

async function handleToggle(row: AdminCategory, val: boolean) {
  // Optimistic update: flip local state immediately, rollback on failure
  const prev = row.is_active;
  row.is_active = val ? 1 : 0;
  const { error } = await fetchUpdateCategory(row.key, { isActive: val });
  if (error) {
    row.is_active = prev;
    return;
  }
  window.$message?.success(val ? '已启用' : '已禁用');
}

async function handleSubmit() {
  if (!isEdit.value && !/^[a-z0-9_]+$/.test(form.key)) {
    window.$message?.warning('分类标识只能含小写字母、数字、下划线');
    return;
  }
  if (!form.name.trim()) {
    window.$message?.warning('请填写分类名称');
    return;
  }
  submitting.value = true;
  const payload = { name: form.name.trim(), icon: form.icon, sortOrder: form.sortOrder, isActive: form.isActive };
  if (isEdit.value) {
    const { error } = await fetchUpdateCategory(form.key, payload);
    if (!error) {
      window.$message?.success('分类已更新');
      showModal.value = false;
      loadCategories();
    }
  } else {
    const { error } = await fetchCreateCategory({ key: form.key, ...payload });
    if (!error) {
      window.$message?.success('分类已创建');
      showModal.value = false;
      loadCategories();
    }
  }
  submitting.value = false;
}

function handleDelete(row: AdminCategory) {
  dialog.warning({
    title: '确认删除',
    content: `确定删除分类「${row.name}」？`,
    positiveText: '确认删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      const { error } = await fetchDeleteCategory(row.key);
      if (!error) {
        window.$message?.success('分类已删除');
        loadCategories();
      }
      // 后端拒绝(分类下有商品)时,请求层会自动 toast 后端消息
    },
  });
}

onMounted(() => { loadCategories(); });
</script>

<template>
  <NCard title="商品分类" :bordered="false" class="card-wrapper">
    <template #header-extra>
      <NButton type="primary" @click="openCreate">
        <template #icon><NIcon><PlusOutlined /></NIcon></template>
        新建分类
      </NButton>
    </template>
    <NDataTable :columns="columns" :data="categories" :loading="loading" :row-key="(r: AdminCategory) => r.key" />

    <NModal v-model:show="showModal" preset="card" :title="isEdit ? '编辑分类' : '新建分类'" style="width:480px">
      <NForm :model="form" label-placement="top">
        <NFormItem label="分类标识 (key)" required>
          <NInput v-model:value="form.key" :disabled="isEdit" placeholder="小写字母/数字/下划线，例：drink" />
        </NFormItem>
        <NFormItem label="分类名称" required>
          <NInput v-model:value="form.name" placeholder="例：饮品" />
        </NFormItem>
        <NFormItem label="图标">
          <ImageUpload v-model="form.icon" :width="120" :height="120" />
        </NFormItem>
        <NFormItem label="排序">
          <NInputNumber v-model:value="form.sortOrder" :min="0" style="width:100%" />
        </NFormItem>
        <NFormItem label="启用">
          <NSwitch v-model:value="form.isActive" />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showModal = false">取消</NButton>
          <NButton type="primary" :loading="submitting" @click="handleSubmit">{{ isEdit ? '保存' : '创建' }}</NButton>
        </NSpace>
      </template>
    </NModal>
  </NCard>
</template>

<style scoped></style>
