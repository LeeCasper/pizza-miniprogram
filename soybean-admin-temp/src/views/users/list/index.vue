<script setup lang="ts">
import { ref, onMounted, h } from 'vue';
import { NCard, NDataTable, NTag, NAvatar, NButton, NSpace, NIcon, NDrawer, NDrawerContent, NForm, NFormItem, NInput, NInputNumber, NSelect } from 'naive-ui';
import { EditOutlined } from '@vicons/antd';
import type { DataTableColumns } from 'naive-ui';
import { fetchUsers, fetchUpdateUser, fetchUpdateUserBirthday, fetchMemberTiers, type UserEditData } from '@/service/api';
import { formatPrice } from '@/utils/format';

defineOptions({ name: 'UserList' });

const users = ref<any[]>([]);
const loading = ref(false);
const drawerOpen = ref(false);
const editForm = ref<UserEditData & { id: number; name: string; birthday: string }>({
  id: 0,
  name: '',
  phone: '',
  birthday: '',
  points: 0,
  balance: 0,
  totalSpent: 0,
  memberLevel: 'silver',
});
const saving = ref(false);

const memberLevelOptions = ref<{ label: string; value: string }[]>([
  { label: '银卡', value: 'silver' },
  { label: '金卡', value: 'gold' },
  { label: '玫瑰金', value: 'rose_gold' },
  { label: '铂金', value: 'platinum' },
  { label: '钻石', value: 'diamond' },
]);

async function loadMemberTierOptions() {
  const { data } = await fetchMemberTiers();
  if (data && Array.isArray(data) && data.length > 0) {
    memberLevelOptions.value = data.map(t => ({ label: t.name, value: t.levelKey }));
  }
}

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
  { title: '生日', key: 'birthday', width: 100,
    render(row: any) { return row.birthday || '—'; }
  },
  {
    title: '等级', key: 'memberLevel', width: 80,
    render(row) {
      const map: Record<string, { label: string; type: 'info' | 'warning' | 'error' | 'default' }> = {
        silver: { label: '银卡', type: 'default' },
        gold: { label: '金卡', type: 'warning' },
        rose_gold: { label: '玫瑰金', type: 'info' },
        platinum: { label: '铂金', type: 'info' },
        diamond: { label: '钻石', type: 'error' },
      };
      const m = map[row.memberLevel] || { label: row.memberLevel || '—', type: 'default' as const };
      return h(NTag, { type: m.type, size: 'small', bordered: false }, () => m.label);
    }
  },
  { title: '积分', key: 'points', width: 80 },
  { title: '余额', key: 'balance', width: 80,
    render(row) { return formatPrice(row.balance); }
  },
  { title: '累计消费', key: 'totalSpent', width: 100,
    render(row) { return formatPrice(row.totalSpent); }
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
    birthday: row.birthday || '',
    points: row.points || 0,
    balance: Number(row.balance || 0),
    totalSpent: Number(row.totalSpent || 0),
    memberLevel: row.memberLevel || 'silver',
  };
  drawerOpen.value = true;
}

async function handleSave() {
  if (!editForm.value.id) {
    window.$message?.warning('请先选择用户');
    return;
  }
  saving.value = true;
  try {
    const { id, name, birthday, ...rest } = editForm.value;
    // Save general user data
    const { error } = await fetchUpdateUser(id, { name, ...rest } as UserEditData);
    if (error) {
      window.$message?.error('更新失败');
      return;
    }
    // Save birthday separately (admin override, no lock)
    const bday = birthday || null;
    const { error: bdayError } = await fetchUpdateUserBirthday(id, bday);
    if (bdayError) {
      window.$message?.warning('用户信息已保存，但生日更新失败');
    } else {
      window.$message?.success('用户信息已更新');
    }
    drawerOpen.value = false;
    loadUsers();
  } catch (e: any) {
    window.$message?.error(e?.message || '更新失败');
  } finally {
    saving.value = false;
  }
}

onMounted(() => { loadUsers(); loadMemberTierOptions(); });
</script>

<template>
  <NCard title="用户管理" :bordered="false" class="card-wrapper">
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
          <NFormItem label="生日">
            <NInput v-model:value="editForm.birthday" placeholder="YYYY-MM-DD，如 1990-05-20" />
          </NFormItem>
          <NFormItem label="积分">
            <NInputNumber v-model:value="editForm.points" :min="0" style="width: 100%" />
          </NFormItem>
          <NFormItem label="余额">
            <NInputNumber v-model:value="editForm.balance" :min="0" :step="0.01" style="width: 100%" />
          </NFormItem>
          <NFormItem label="累计消费">
            <NInputNumber v-model:value="editForm.totalSpent" :min="0" :step="0.01" style="width: 100%" />
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
  </NCard>
</template>

<style scoped></style>
