<script setup lang="ts">
import { ref, onMounted, h } from 'vue';
import { NCard, NDataTable, NTag, NSelect, NSpace } from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import { fetchPaymentRecords } from '@/service/api';
import { formatPrice } from '@/utils/format';

defineOptions({ name: 'PaymentList' });

const records = ref<any[]>([]);
const loading = ref(false);
const typeFilter = ref<string | null>(null);
const statusFilter = ref<string | null>(null);

const typeOptions = [
  { label: '全部类型', value: null },
  { label: '在线点单', value: 'order' },
  { label: '余额充值', value: 'recharge' },
];

const statusOptions = [
  { label: '全部状态', value: null },
  { label: '成功', value: 'success' },
  { label: '待支付', value: 'pending' },
  { label: '失败', value: 'failed' },
  { label: '已关闭', value: 'closed' },
];

const statusMap: Record<string, { label: string; type: 'success' | 'warning' | 'error' | 'default' }> = {
  success: { label: '成功', type: 'success' },
  pending: { label: '待支付', type: 'warning' },
  failed: { label: '失败', type: 'error' },
  closed: { label: '已关闭', type: 'default' },
};

const columns: DataTableColumns<any> = [
  { title: '交易单号', key: 'outTradeNo', width: 80 },
  { title: '用户', key: 'userName', width: 100 },
  {
    title: '类型', key: 'type', width: 90,
    render(row) {
      const label = row.type === 'recharge' ? '余额充值' : '在线点单';
      const type = row.type === 'recharge' ? 'info' : 'success';
      return h(NTag, { type, size: 'small', bordered: false }, () => label);
    }
  },
  {
    title: '金额', key: 'amount', width: 80, align: 'right',
    render(row) { return formatPrice(row.amount); }
  },
  {
    title: '状态', key: 'status', width: 80,
    render(row) {
      const s = statusMap[row.status] || { label: row.status, type: 'default' as const };
      return h(NTag, { type: s.type, size: 'small', bordered: false }, () => s.label);
    }
  },
  {
    title: '支付方式', key: 'transactionId', width: 90,
    render(row) {
      if (!row.transactionId) return '—';
      return h(NTag, { type: 'info', size: 'small', bordered: false }, () => '微信支付');
    }
  },
  { title: '微信交易号', key: 'transactionId', width: 80, render(row) { return row.transactionId || '—'; } },
  { title: '关联ID', key: 'referenceId', width: 80 },
  { title: '时间', key: 'createdAt', width: 160 },
];

async function loadRecords() {
  loading.value = true;
  const params: Record<string, any> = {};
  if (typeFilter.value) params.type = typeFilter.value;
  if (statusFilter.value) params.status = statusFilter.value;
  const { data, error } = await fetchPaymentRecords(params);
  if (!error && data) {
    records.value = data.list || [];
  }
  loading.value = false;
}

function onFilterChange() {
  loadRecords();
}

onMounted(() => { loadRecords(); });
</script>

<template>
  <NCard title="交易记录" :bordered="false" class="card-wrapper">
    <template #header-extra>
      <NSpace>
        <NSelect v-model:value="typeFilter" :options="typeOptions" style="width:120px" @update:value="onFilterChange" />
        <NSelect v-model:value="statusFilter" :options="statusOptions" style="width:120px" @update:value="onFilterChange" />
      </NSpace>
    </template>
    <NDataTable :columns="columns" :data="records" :loading="loading" :row-key="(r: any) => r.id" />
  </NCard>
</template>

<style scoped></style>
