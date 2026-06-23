<script setup lang="ts">
import { ref, onMounted, h, reactive } from 'vue';
import { NCard, NDataTable, NTag } from 'naive-ui';
import type { DataTableColumns, PaginationProps } from 'naive-ui';
import { fetchLuckyRecords } from '@/service/api';
import type { LuckyRecord } from '@/service/api';

defineOptions({ name: 'LuckyWheelRecordsList' });

const records = ref<LuckyRecord[]>([]);
const loading = ref(false);

const sourceMap: Record<string, { label: string; type: 'success' | 'info' | 'warning' }> = {
  free: { label: '免费', type: 'success' },
  points: { label: '积分加抽', type: 'info' },
  again: { label: '再来一次', type: 'warning' },
};

const typeMap: Record<string, string> = {
  coupon: '优惠券', points: '积分', balance: '余额', thanks: '谢谢参与', again: '再来一次',
};

function rewardText(row: LuckyRecord): string {
  if (row.prizeType === 'points') return `${row.pointsAmount ?? 0} 积分`;
  if (row.prizeType === 'balance') return `¥${Number(row.balanceAmount ?? 0).toFixed(2)}`;
  if (row.prizeType === 'coupon') return row.couponId ? `券#${row.couponId}` : '—';
  return '—';
}

const columns: DataTableColumns<LuckyRecord> = [
  { title: 'ID', key: 'id', width: 70, align: 'center' },
  { title: '用户', key: 'userName', width: 140, render(row) { return row.userName || `用户#${row.userId}`; } },
  { title: '奖品类型', key: 'prizeType', width: 90, render(row) { return typeMap[row.prizeType] || row.prizeType; } },
  { title: '奖品', key: 'prizeName', width: 140 },
  { title: '奖励', key: 'reward', width: 110, render(row) { return rewardText(row); } },
  {
    title: '来源', key: 'source', width: 90,
    render(row) {
      const m = sourceMap[row.source] || { label: row.source, type: 'info' as const };
      return h(NTag, { type: m.type, size: 'small', bordered: false }, () => m.label);
    }
  },
  { title: '消耗积分', key: 'costPoints', width: 90, align: 'center' },
  { title: '时间', key: 'createdAt', width: 170 },
];

const pagination = reactive<PaginationProps>({
  page: 1,
  pageSize: 20,
  itemCount: 0,
  showSizePicker: true,
  pageSizes: [20, 50, 100],
  onChange: (page: number) => { pagination.page = page; load(); },
  onUpdatePageSize: (size: number) => { pagination.pageSize = size; pagination.page = 1; load(); },
});

async function load() {
  loading.value = true;
  const { data, error } = await fetchLuckyRecords({ page: pagination.page, limit: pagination.pageSize });
  if (!error && data) {
    records.value = data.list;
    pagination.itemCount = data.total;
  }
  loading.value = false;
}

onMounted(() => { load(); });
</script>

<template>
  <NCard title="抽奖记录" :bordered="false" class="card-wrapper">
    <NDataTable
      remote
      :columns="columns"
      :data="records"
      :loading="loading"
      :pagination="pagination"
      :row-key="(r: LuckyRecord) => r.id"
    />
  </NCard>
</template>

<style scoped></style>
