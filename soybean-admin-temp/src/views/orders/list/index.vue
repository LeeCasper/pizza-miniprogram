<script setup lang="ts">
import { ref, onMounted, h } from 'vue';
import { useRouter } from 'vue-router';
import { NDataTable, NTag, NButton, NSpace, NSelect } from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import { fetchOrders } from '@/service/api';

defineOptions({ name: 'OrderList' });

const router = useRouter();
const orders = ref<any[]>([]);
const loading = ref(false);
const statusFilter = ref<string | null>(null);

const statusOptions = [
  { label: '全部', value: null },
  { label: '待处理', value: 'waiting' },
  { label: '制作中', value: 'preparing' },
  { label: '已完成', value: 'completed' },
  { label: '已取消', value: 'cancelled' },
];

const statusMap: Record<string, { label: string; type: 'warning' | 'info' | 'success' | 'error' | 'default' }> = {
  waiting: { label: '待处理', type: 'warning' },
  preparing: { label: '制作中', type: 'info' },
  completed: { label: '已完成', type: 'success' },
  cancelled: { label: '已取消', type: 'error' },
};

const columns: DataTableColumns<any> = [
  { title: '订单号', key: 'id', width: 70 },
  { title: '用户', key: 'userName', width: 100 },
  { title: '取餐码', key: 'pickupCode', width: 100 },
  {
    title: '状态', key: 'status', width: 90,
    render(row) {
      const s = statusMap[row.status] || { label: row.status, type: 'default' as const };
      return h(NTag, { type: s.type, size: 'small', bordered: false }, () => s.label);
    }
  },
  {
    title: '金额', key: 'total', width: 80, align: 'right',
    render(row) { return `¥${Number(row.total).toFixed(2)}`; }
  },
  { title: '时间', key: 'createdAt', width: 160 },
  {
    title: '', key: 'actions', width: 60,
    render(row) {
      return h(NButton, { size: 'small', onClick: () => router.push(`/orders/${row.id}`) }, () => '详情');
    }
  },
];

async function loadOrders() {
  loading.value = true;
  const params: Record<string, any> = {};
  if (statusFilter.value) params.status = statusFilter.value;
  const { data, error } = await fetchOrders(params);
  if (!error && data) {
    orders.value = Array.isArray(data) ? data : data.list || [];
  }
  loading.value = false;
}

function onFilterChange() {
  loadOrders();
}

onMounted(() => { loadOrders(); });
</script>

<template>
  <div class="order-list">
    <div class="page-header">
      <h2 class="page-title">订单管理</h2>
      <NSelect v-model:value="statusFilter" :options="statusOptions" style="width:140px" @update:value="onFilterChange" />
    </div>
    <NDataTable :columns="columns" :data="orders" :loading="loading" :row-key="(r: any) => r.id" />
  </div>
</template>

<style scoped>
.order-list { padding: 4px; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.page-title { margin: 0; font-size: 22px; font-weight: 700; }
</style>
