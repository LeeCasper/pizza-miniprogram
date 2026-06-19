<script setup lang="ts">
import { ref, onMounted, h } from 'vue';
import { useRouter } from 'vue-router';
import { NCard, NDataTable, NButton, NTag, NSpace, NIcon, NSwitch, useDialog } from 'naive-ui';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@vicons/antd';
import type { DataTableColumns } from 'naive-ui';
import { fetchMemberTiers, fetchDeleteMemberTier, fetchToggleMemberTier } from '@/service/api';
import type { MemberTier } from '@/service/api';
import { formatPrice } from '@/utils/format';

defineOptions({ name: 'MemberTiersList' });

const router = useRouter();
const dialog = useDialog();
const tiers = ref<MemberTier[]>([]);
const loading = ref(false);

const columns: DataTableColumns<MemberTier> = [
  { title: 'ID', key: 'id', width: 60, align: 'center' },
  { title: '标识', key: 'levelKey', width: 100 },
  { title: '名称', key: 'name', width: 120, render(row) { return h('strong', {}, row.name); } },
  { title: '序号', key: 'levelIndex', width: 60, align: 'center' },
  { title: '最低消费', key: 'minSpent', width: 100, render(row) { return formatPrice(row.minSpent); } },
  { title: '折扣率', key: 'discountRate', width: 80, render(row) { return row.discountRate < 1 ? `${((1 - row.discountRate) * 100).toFixed(0)}折` : '原价'; } },
  { title: '积分倍率', key: 'pointsRewardRate', width: 80, render(row) { return `x${row.pointsRewardRate}`; } },
  { title: '生日礼物', key: 'birthdayGift', width: 180, ellipsis: { tooltip: true } },
  { title: '奖券', key: 'couponValue', width: 80, render(row) { return formatPrice(row.couponValue); } },
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
    title: '操作', key: 'actions', width: 130,
    render(row) {
      return h(NSpace, null, {
        default: () => [
          h(NButton, { size: 'small', quaternary: true, onClick: () => router.push(`/member-tiers/${row.id}/edit`) }, { icon: () => h(NIcon, null, () => h(EditOutlined)) }),
          h(NButton, { size: 'small', quaternary: true, type: 'error', onClick: () => handleDelete(row.id!, row.name) }, { icon: () => h(NIcon, null, () => h(DeleteOutlined)) }),
        ]
      });
    }
  },
];

async function loadTiers() {
  loading.value = true;
  const { data, error } = await fetchMemberTiers();
  if (!error && data) tiers.value = data;
  loading.value = false;
}

async function handleToggle(id: number, val: boolean) {
  const { error } = await fetchToggleMemberTier(id);
  if (error) {
    window.$message?.error('切换状态失败');
    return;
  }
  window.$message?.success(val ? '已启用' : '已禁用');
}

async function handleDelete(id: number, name: string) {
  dialog.warning({
    title: '确认删除',
    content: `确定删除会员等级「${name}」？`,
    positiveText: '确认删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      const { error } = await fetchDeleteMemberTier(id);
      if (!error) {
        window.$message?.success('等级已删除');
        loadTiers();
      }
    },
  });
}

onMounted(() => { loadTiers(); });
</script>

<template>
  <NCard title="会员等级" :bordered="false" class="card-wrapper">
    <template #header-extra>
      <NButton type="primary" @click="router.push('/member-tiers/create')">
        <template #icon><NIcon><PlusOutlined /></NIcon></template>
        新建等级
      </NButton>
    </template>
    <NDataTable :columns="columns" :data="tiers" :loading="loading" :row-key="(r: MemberTier) => r.id ?? 0" />
  </NCard>
</template>

<style scoped></style>
