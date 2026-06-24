<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { NCard, NDescriptions, NDescriptionsItem, NTag, NSelect, NButton, NSpace, NDataTable, NDivider } from 'naive-ui';
import { fetchOrder, fetchUpdateOrderStatus } from '@/service/api';
import { formatPrice } from '@/utils/format';

defineOptions({ name: 'OrderDetail' });

const route = useRoute();
const router = useRouter();
const order = ref<any>(null);
const loading = ref(false);

const statusOptions = [
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

const itemColumns = [
  { title: '商品', key: 'productName' },
  { title: '单价', key: 'price', render(row: any) { return formatPrice(row.price); } },
  { title: '数量', key: 'quantity' },
  { title: '小计', key: 'subtotal', render(row: any) { return formatPrice(row.price * row.quantity); } },
];

async function loadOrder() {
  loading.value = true;
  const { data, error } = await fetchOrder(route.params.id as string);
  if (!error && data) order.value = data;
  loading.value = false;
}

async function handleStatusChange(status: string) {
  const { error } = await fetchUpdateOrderStatus(route.params.id as string, status);
  if (!error) {
    window.$message?.success('状态已更新');
    loadOrder();
  }
}

onMounted(() => { loadOrder(); });
</script>

<template>
  <NCard title="订单详情" :bordered="false" class="card-wrapper" :loading="loading">
    <template #header-extra>
      <NButton quaternary @click="router.push('/orders')">← 返回列表</NButton>
    </template>

    <template v-if="order">
      <NDescriptions label-placement="left" :column="2">
        <NDescriptionsItem label="订单号">{{ order.id }}</NDescriptionsItem>
        <NDescriptionsItem label="用户">{{ order.userName }}</NDescriptionsItem>
        <NDescriptionsItem label="取餐码">
          <code style="font-size:18px;font-weight:700;color:#D32F2F">{{ order.pickupCode }}</code>
        </NDescriptionsItem>
        <NDescriptionsItem label="门店">{{ order.storeName || '—' }}</NDescriptionsItem>
        <NDescriptionsItem label="状态">
          <NTag :type="statusMap[order.status]?.type || 'default'" size="small" :bordered="false">
            {{ statusMap[order.status]?.label || order.status }}
          </NTag>
        </NDescriptionsItem>
        <NDescriptionsItem label="总金额">{{ formatPrice(order.total) }}</NDescriptionsItem>
        <NDescriptionsItem label="实付">{{ formatPrice(order.paidAmount || order.total) }}</NDescriptionsItem>
        <NDescriptionsItem label="支付方式">
          <NTag v-if="order.paymentMethod" :type="order.paymentMethod === 'wechat' ? 'info' : (order.paymentMethod === 'coupon' ? 'warning' : 'success')" size="small" :bordered="false">
            {{ order.paymentMethod === 'wechat' ? '微信支付' : (order.paymentMethod === 'coupon' ? '兑换券' : '余额支付') }}
          </NTag>
          <span v-else style="color: var(--n-text-color-3)">待支付</span>
        </NDescriptionsItem>
        <NDescriptionsItem label="交易单号">{{ order.transactionId || '—' }}</NDescriptionsItem>
        <NDescriptionsItem label="支付时间">{{ order.paidAt || '—' }}</NDescriptionsItem>
        <NDescriptionsItem label="备注">{{ order.note || '—' }}</NDescriptionsItem>
        <NDescriptionsItem label="下单时间">{{ order.createdAt }}</NDescriptionsItem>
      </NDescriptions>

      <NDivider />
      <h4>状态变更</h4>
      <NSelect :value="order.status" :options="statusOptions" style="width:140px" @update:value="handleStatusChange" />

      <NDivider />
      <h4>商品明细</h4>
      <NDataTable :columns="itemColumns" :data="order.items || []" :row-key="(r: any) => r.id || r.productId" />
    </template>
  </NCard>
</template>

<style scoped></style>
