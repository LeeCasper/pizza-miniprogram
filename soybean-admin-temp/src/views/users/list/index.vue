<script setup lang="ts">
import { ref, onMounted, h } from 'vue';
import { NDataTable, NTag, NAvatar, NButton, NSpace, NIcon, NDrawer, NDrawerContent, NForm, NFormItem, NInput, NInputNumber, NSelect } from 'naive-ui';
import { EditOutlined } from '@vicons/antd';
import type { DataTableColumns } from 'naive-ui';
import { fetchUsers, fetchUpdateUser, type UserEditData } from '@/service/api';

defineOptions({ name: 'UserList' });

const users = ref<any[]>([]);
const loading = ref(false);
const drawerOpen = ref(false);
const editForm = ref<UserEditData & { id: number; name: string }>({
  id: 0,
  name: '',
  phone: '',
  points: 0,
  balance: 0,
  memberLevel: 'normal',
});
const saving = ref(false);

const memberLevelOptions = [
  { label: '普通', value: 'normal' },
  { label: '黄金', value: 'gold' },
  { label: '铂金', value: 'platinum' },
  { label: '钻石', value: 'diamond' },
];

const columns: DataTableColumns<any> = [
  { title: 'ID', key: 'id', width: 60 },
  {
    title: '头像', key: 'avatar', width: 60,
    render(row) { return h(NAvatar, { src: row.avatar, size: 32, round: true }); }
  },
  {
    title: '昵称', key: 'name', width: 120,
    render(row) { return row.name || '—'; }
  },
  { title: '手机号', key: 'phone', width: 130 },
  {
    title: '等级', key: 'memberLevel', width: 80,
    render(row) {
      const map: Record<string, { label: string; type: 'info' | 'warning' | 'error' | 'default' }> = {
        gold: { label: '黄金', type: 'warning' },
        platinum: { label: '铂金', type: 'info' },
        diamond: { label: '钻石', type: 'error' },
      };
      const m = map[row.memberLevel] || { label: row.memberLevel || '普通', type: 'default' as const };
      return h(NTag, { type: m.type, size: 'small', bordered: false }, () => m.label);
    }
  },
  { title: '积分', key: 'points', width: 80 },
  { title: '余额', key: 'balance', width: 80,
    render(row) { return `¥${Number(row.balance || 0).toFixed(2)}`; }
  },
  { title: '订单数', key: 'orderCount', width: 80 },
  { title: '注册时间', key: 'createdAt', width: 160 },
  {
    title: '操作', key: 'actions', width: 70,
    render(row) {
      return h(NButton, { size: 'small', quaternary: true, onClick: () => handleEdit(row) }, { icon: () => h(NIcon, null, () => h(EditOutlined)) });
    }
  },
];

async function loadUsers() {
  loading.value = true;
  const { data, error } = await fetchUsers();
  if (!error && data) {
    users.value = Array.isArray(data) ? data : data.list || [];
  }
  loading.value = false;
}

function handleEdit(row: any) {
  editForm.value = {
    id: row.id,
    name: row.name || '',
    phone: row.phone || '',
    points: row.points || 0,
    balance: Number(row.balance || 0),
    memberLevel: row.memberLevel || 'normal',
  };
  drawerOpen.value = true;
}

async function handleSave() {
  saving.value = true;
  const { id, name, ...rest } = editForm.value;
  const { error } = await fetchUpdateUser(id, { name, ...rest } as UserEditData);
  saving.value = false;
  if (!error) {
    window.$message?.success('用户信息已更新');
    drawerOpen.value = false;
    loadUsers();
  }
}

onMounted(() => { loadUsers(); });
</script>

<template>
  <div class="user-list">
    <h2 class="page-title">用户管理</h2>
    <NDataTable :columns="columns" :data="users" :loading="loading" :row-key="(r: any) => r.id" />

    <NDrawer v-model:show="drawerOpen" width="400">
      <NDrawerContent title="编辑用户" closable>
        <NForm label-placement="left" label-width="80">
          <NFormItem label="昵称">
            <NInput v-model:value="editForm.name" placeholder="请输入昵称" />
          </NFormItem>
          <NFormItem label="手机号">
            <NInput v-model:value="editForm.phone" placeholder="请输入手机号" />
          </NFormItem>
          <NFormItem label="积分">
            <NInputNumber v-model:value="editForm.points" :min="0" style="width: 100%" />
          </NFormItem>
          <NFormItem label="余额">
            <NInputNumber v-model:value="editForm.balance" :min="0" :step="0.01" style="width: 100%" />
          </NFormItem>
          <NFormItem label="会员等级">
            <NSelect v-model:value="editForm.memberLevel" :options="memberLevelOptions" />
          </NFormItem>
        </NForm>
        <template #footer>
          <NSpace justify="end">
            <NButton @click="drawerOpen = false">取消</NButton>
            <NButton type="primary" :loading="saving" @click="handleSave">保存</NButton>
          </NSpace>
        </template>
      </NDrawerContent>
    </NDrawer>
  </div>
</template>

<style scoped>
.user-list { padding: 4px; }
.page-title { margin: 0 0 16px; font-size: 22px; font-weight: 700; }
</style>
