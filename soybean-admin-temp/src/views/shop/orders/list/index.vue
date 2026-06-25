<script setup lang="ts">
import { ref, onMounted, h } from 'vue';
import { useRouter } from 'vue-router';
import { NCard, NDataTable, NTag, NButton, NSpace, NSelect } from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import { fetchShopOrders } from '@/service/api/shop';
import { formatPrice } from '@/utils/format';

defineOptions({ name: 'ShopOrdersList' });

const router = useRouter();
const orders = ref<any[]>([]);
const loading = ref(false);
const statusFilter = ref<string | null>(null);
const paymentFilter = ref<string | null>(null);

const statusOptions = [
  { label: '全部', value: 'all' },
  { label: '待支付', value: 'pending' },
  { label: '已支付', value: 'paid' },
  { label: '已发货', value: 'shipped' },
  { label: '已完成', value: 'completed' },
  { label: '已取消', value: 'cancelled' },
];

const paymentOptions = [
  { label: '全部', value: 'all' },
  { label: '微信支付', value: 'wechat' },
  { label: '余额支付', value: 'balance' },
  { label: '待支付', value: 'unpaid' },
];

const statusMap: Record<string, { label: string; type: 'warning' | 'info' | 'success' | 'error' | 'default' }> = {
  pending: { label: '待支付', type: 'warning' },
  paid: { label: '已支付', type: 'info' },
  shipped: { label: '已发货', type: 'info' },
  completed: { label: '已完成', type: 'success' },
  cancelled: { label: '已取消', type: 'error' },
};

const columns: DataTableColumns<any> = [
  { title: '订单号', key: 'id', width: 150 },
  { title: '用户', key: 'userName', width: 100 },
  {
    title: '状态', key: 'status', width: 90,
    render(row) {
      const s = statusMap[row.status] || { label: row.status, type: 'default' as const };
      return h(NTag, { type: s.type, size: 'small', bordered: false }, () => s.label);
    }
  },
  {
    title: '退款', key: 'refundStatus', width: 80,
    render(row) {
      if (!row.refundStatus) return '—';
      const refundMap: Record<string, { label: string; type: 'warning' | 'success' | 'error' | 'default' }> = {
        processing: { label: '处理中', type: 'warning' },
        success: { label: '已退款', type: 'success' },
        failed: { label: '失败', type: 'error' },
      };
      const s = refundMap[row.refundStatus] || { label: row.refundStatus, type: 'default' as const };
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
    title: '金额', key: 'totalAmount', width: 90, align: 'right',
    render(row) { return formatPrice(row.totalAmount); }
  },
  { title: '收货人', key: 'recipientName', width: 90 },
  { title: '下单时间', key: 'createdAt', width: 160 },
  {
    title: '', key: 'actions', width: 60,
    render(row) {
      return h(NButton, { size: 'small', onClick: () => router.push(`/shop/orders/${row.id}`) }, () => '详情');
    }
  },
];

async function loadOrders() {
  loading.value = true;
  const params: Record<string, any> = {};
  if (statusFilter.value && statusFilter.value !== 'all') params.status = statusFilter.value;
  if (paymentFilter.value && paymentFilter.value !== 'all') params.paymentMethod = paymentFilter.value;
  const { data, error } = await fetchShopOrders(params);
  if (!error && data) {
    orders.value = data.list || data;
  }
  loading.value = false;
}

function onFilterChange() {
  loadOrders();
}

onMounted(() => { loadOrders(); });
</script>

<template>
  <NCard title="商城订单" :bordered="false" class="card-wrapper">
    <template #header-extra>
      <NSpace>
        <NSelect v-model:value="statusFilter" :options="statusOptions" style="width:120px" @update:value="onFilterChange" />
        <NSelect v-model:value="paymentFilter" :options="paymentOptions" style="width:120px" @update:value="onFilterChange" />
      </NSpace>
    </template>
    <NDataTable :columns="columns" :data="orders" :loading="loading" :row-key="(r: any) => r.id" />
  </NCard>
</template>

<style scoped></style>
