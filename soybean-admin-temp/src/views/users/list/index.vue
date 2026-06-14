<script setup lang="ts">
import { ref, onMounted, h } from 'vue';
import { NDataTable, NTag, NAvatar } from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import { fetchUsers } from '@/service/api';

defineOptions({ name: 'UserList' });

const users = ref<any[]>([]);
const loading = ref(false);

const columns: DataTableColumns<any> = [
  { title: 'ID', key: 'id', width: 60 },
  {
    title: '头像', key: 'avatar', width: 60,
    render(row) { return h(NAvatar, { src: row.avatar, size: 32, round: true }); }
  },
  { title: '昵称', key: 'nickname', width: 120 },
  { title: '手机号', key: 'phone', width: 130 },
  {
    title: '等级', key: 'memberLevel', width: 80,
    render(row) {
      const map: Record<string, { label: string; type: 'info' | 'warning' | 'error' | 'default' }> = {
        gold: { label: '黄金', type: 'warning' },
        silver: { label: '白银', type: 'info' },
        diamond: { label: '钻石', type: 'error' },
      };
      const m = map[row.memberLevel] || { label: row.memberLevel || '普通', type: 'default' as const };
      return h(NTag, { type: m.type, size: 'small', bordered: false }, () => m.label);
    }
  },
  { title: '积分', key: 'points', width: 80 },
  { title: '订单数', key: 'orderCount', width: 80 },
  { title: '注册时间', key: 'createdAt', width: 160 },
];

async function loadUsers() {
  loading.value = true;
  const { data, error } = await fetchUsers();
  if (!error && data) {
    users.value = Array.isArray(data) ? data : data.list || [];
  }
  loading.value = false;
}

onMounted(() => { loadUsers(); });
</script>

<template>
  <div class="user-list">
    <h2 class="page-title">用户管理</h2>
    <NDataTable :columns="columns" :data="users" :loading="loading" :row-key="(r: any) => r.id" />
  </div>
</template>

<style scoped>
.user-list { padding: 4px; }
.page-title { margin: 0 0 16px; font-size: 22px; font-weight: 700; }
</style>
