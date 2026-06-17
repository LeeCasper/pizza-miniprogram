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
const paymentStatusFilter = ref<string | null>(null);

const statusOptions = [
  { label: '全部', value: null },
  { label: '待处理', value: 'waiting' },
  { label: '制作中', value: 'preparing' },
  { label: '已完成', value: 'completed' },
  { label: '已取消', value: 'cancelled' },
];

const paymentStatusOptions = [
  { label: '全部支付', value: null },
  { label: '已支付', value: 'paid' },
  { label: '待支付', value: 'unpaid' },
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
    title: '支付', key: 'paymentMethod', width: 90,
    render(row) {
      if (!row.paymentMethod) {
        return h(NTag, { type: 'error', size: 'small', bordered: false }, () => '待支付');
      }
      const label = row.paymentMethod === 'wechat' ? '微信支付' : '余额支付';
      const type = row.paymentMethod === 'wechat' ? 'info' : 'success';
      return h(NTag, { type, size: 'small', bordered: false }, () => label);
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
  if (paymentStatusFilter.value) params.paymentStatus = paymentStatusFilter.value;
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
      <NSpace>
        <NSelect v-model:value="statusFilter" :options="statusOptions" style="width:120px" @update:value="onFilterChange" />
        <NSelect v-model:value="paymentStatusFilter" :options="paymentStatusOptions" style="width:120px" @update:value="onFilterChange" />
      </NSpace>
    </div>
    <NDataTable :columns="columns" :data="orders" :loading="loading" :row-key="(r: any) => r.id" />
  </div>
</template>

<style scoped>
.order-list { padding: 4px; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.page-title { margin: 0; font-size: 22px; font-weight: 700; }
</style>
