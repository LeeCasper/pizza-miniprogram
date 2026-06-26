<script setup lang="ts">
import { ref, onMounted, h } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { NCard, NDescriptions, NDescriptionsItem, NTag, NSelect, NButton, NSpace, NDataTable, NDivider, NInput, useDialog } from 'naive-ui';
import { fetchShopOrder, fetchUpdateShopOrderStatus, fetchUpdateShopOrderShipping, fetchAutoDetectCarrier } from '@/service/api/shop';
import { formatPrice } from '@/utils/format';

defineOptions({ name: 'ShopOrdersDetail' });

const route = useRoute();
const router = useRouter();
const dialog = useDialog();
const order = ref<any>(null);
const loading = ref(false);
const shippingCompany = ref('');
const trackingNo = ref('');
const shippingLoading = ref(false);
const detectedCarriersDetail = ref<{ label: string; value: string }[]>([]);
const detectLoadingDetail = ref(false);
const detectMessageDetail = ref('');
const refundReason = ref('');

const statusOptionsMap: Record<string, { label: string; value: string; type: 'warning' | 'info' | 'success' | 'error' | 'default' }[]> = {
  pending: [
    { label: '确认支付', value: 'paid', type: 'info' },
    { label: '取消订单', value: 'cancelled', type: 'error' },
  ],
  paid: [
    { label: '发货', value: 'shipped', type: 'info' },
    { label: '取消(退款)', value: 'cancelled', type: 'error' },
  ],
  shipped: [
    { label: '完成', value: 'completed', type: 'success' },
  ],
  completed: [],
  cancelled: [],
};

const statusMap: Record<string, { label: string; type: 'warning' | 'info' | 'success' | 'error' | 'default' }> = {
  pending: { label: '待支付', type: 'warning' },
  paid: { label: '已支付', type: 'info' },
  shipped: { label: '已发货', type: 'info' },
  completed: { label: '已完成', type: 'success' },
  cancelled: { label: '已取消', type: 'error' },
};

const itemColumns = [
  { title: '商品图片', key: 'productImage', width: 80, render(row: any) { return row.productImage ? h('img', { src: row.productImage, style: 'width:48px;height:48px;border-radius:6px;object-fit:cover' }) : '—'; } },
  { title: '商品', key: 'productName' },
  { title: '单价', key: 'price', render(row: any) { return formatPrice(row.price); } },
  { title: '数量', key: 'quantity' },
  { title: '小计', key: 'subtotal', render(row: any) { return formatPrice(row.subtotal); } },
];

async function loadOrder() {
  loading.value = true;
  const { data, error } = await fetchShopOrder(route.params.id as string);
  if (!error && data) {
    order.value = data;
    shippingCompany.value = data.shippingCompany || '';
    trackingNo.value = data.trackingNo || '';
  }
  loading.value = false;
}

async function handleStatusChange(status: string) {
  // 取消已支付订单 → 弹窗确认退款
  if (status === 'cancelled' && order.value?.paymentMethod) {
    dialog.warning({
      title: '确认取消并退款',
      content: () => {
        return h('div', { style: 'padding: 12px 0' }, [
          h('p', '该订单已支付，取消将自动触发退款。'),
          h('p', { style: 'margin-top: 8px; color: var(--n-text-color-3); font-size: 13px' },
            `支付方式: ${order.value.paymentMethod === 'wechat' ? '微信支付' : '余额支付'}, 金额: ¥${Number(order.value.paidAmount || order.value.totalAmount).toFixed(2)}`
          ),
          h(NInput, {
            placeholder: '退款原因（选填）',
            value: refundReason.value,
            onUpdateValue: (v: string) => { refundReason.value = v; },
            style: 'margin-top: 12px',
          }),
        ]);
      },
      positiveText: '确认取消并退款',
      negativeText: '取消',
      onPositiveClick: async () => {
        const { error } = await fetchUpdateShopOrderStatus(
          route.params.id as string,
          status,
          refundReason.value || undefined,
        );
        if (!error) {
          window.$message?.success('已取消并退款');
          refundReason.value = '';
          loadOrder();
        }
      },
    });
    return;
  }

  // 普通状态变更
  const { error } = await fetchUpdateShopOrderStatus(route.params.id as string, status);
  if (!error) {
    window.$message?.success('状态已更新');
    loadOrder();
  }
}

async function handleAutoDetectDetail() {
  if (!trackingNo.value.trim()) {
    window.$message?.warning('请先输入运单号');
    return;
  }
  detectLoadingDetail.value = true;
  detectMessageDetail.value = '';
  detectedCarriersDetail.value = [];
  const { data, error } = await fetchAutoDetectCarrier(trackingNo.value.trim());
  detectLoadingDetail.value = false;
  if (error || !data) {
    detectMessageDetail.value = '识别失败，请手动选择物流公司';
    return;
  }
  const carriers = (data.auto?.length ? data.auto : data.com) || [];
  if (carriers.length === 0) {
    detectMessageDetail.value = '未识别到物流公司，请手动输入';
    return;
  }
  detectedCarriersDetail.value = carriers.map((c: any) => ({
    label: c.name || c.comCode,
    value: c.name || c.comCode,
  }));
  if (carriers.length === 1) {
    shippingCompany.value = carriers[0].name || carriers[0].comCode;
    detectMessageDetail.value = `已识别：${carriers[0].name || carriers[0].comCode}`;
  } else {
    detectMessageDetail.value = `识别到 ${carriers.length} 家物流公司，请选择`;
  }
}

async function handleSaveShipping() {
  if (!shippingCompany.value.trim() || !trackingNo.value.trim()) {
    window.$message?.warning('请填写物流公司和运单号');
    return;
  }
  shippingLoading.value = true;
  const { error } = await fetchUpdateShopOrderShipping(route.params.id as string, {
    shippingCompany: shippingCompany.value.trim(),
    trackingNo: trackingNo.value.trim(),
  });
  shippingLoading.value = false;
  if (!error) {
    window.$message?.success('物流信息已保存');
    loadOrder();
  }
}

onMounted(() => { loadOrder(); });
</script>

<template>
  <NCard title="商城订单详情" :bordered="false" class="card-wrapper" :loading="loading">
    <template #header-extra>
      <NButton quaternary @click="router.push('/shop/orders')">← 返回列表</NButton>
    </template>

    <template v-if="order">
      <NDescriptions label-placement="left" :column="2">
        <NDescriptionsItem label="订单号">{{ order.id }}</NDescriptionsItem>
        <NDescriptionsItem label="用户">{{ order.userName || order.userId }}</NDescriptionsItem>
        <NDescriptionsItem label="状态">
          <NTag :type="statusMap[order.status]?.type || 'default'" size="small" :bordered="false">
            {{ statusMap[order.status]?.label || order.status }}
          </NTag>
        </NDescriptionsItem>
        <NDescriptionsItem label="总金额">{{ formatPrice(order.totalAmount) }}</NDescriptionsItem>
        <NDescriptionsItem label="实付">{{ formatPrice(order.paidAmount || order.totalAmount) }}</NDescriptionsItem>
        <NDescriptionsItem label="支付方式">
          <NTag v-if="order.paymentMethod" :type="order.paymentMethod === 'wechat' ? 'info' : 'success'" size="small" :bordered="false">
            {{ order.paymentMethod === 'wechat' ? '微信支付' : '余额支付' }}
          </NTag>
          <span v-else style="color: var(--n-text-color-3)">待支付</span>
        </NDescriptionsItem>
        <NDescriptionsItem label="收货人">{{ order.recipientName || '—' }}</NDescriptionsItem>
        <NDescriptionsItem label="手机号">{{ order.recipientPhone || '—' }}</NDescriptionsItem>
        <NDescriptionsItem label="收货地址" :span="2">{{ order.recipientAddress || '—' }}</NDescriptionsItem>
        <NDescriptionsItem label="物流公司">{{ order.shippingCompany || '—' }}</NDescriptionsItem>
        <NDescriptionsItem label="运单号">{{ order.trackingNo || '—' }}</NDescriptionsItem>
        <NDescriptionsItem label="备注">{{ order.note || '—' }}</NDescriptionsItem>
        <NDescriptionsItem v-if="order.refundStatus" label="退款状态">
          <NTag :type="order.refundStatus === 'success' ? 'success' : order.refundStatus === 'processing' ? 'warning' : 'error'" size="small" :bordered="false">
            {{ order.refundStatus === 'success' ? '已退款' : order.refundStatus === 'processing' ? '处理中' : '失败' }}
          </NTag>
        </NDescriptionsItem>
        <NDescriptionsItem v-if="order.refundAmount" label="退款金额">{{ formatPrice(order.refundAmount) }}</NDescriptionsItem>
        <NDescriptionsItem v-if="order.refundReason" label="退款原因" :span="2">{{ order.refundReason }}</NDescriptionsItem>
        <NDescriptionsItem v-if="order.refundedAt" label="退款时间">{{ order.refundedAt }}</NDescriptionsItem>
        <NDescriptionsItem label="支付时间">{{ order.paidAt || '—' }}</NDescriptionsItem>
        <NDescriptionsItem label="发货时间">{{ order.shippedAt || '—' }}</NDescriptionsItem>
        <NDescriptionsItem label="完成时间">{{ order.completedAt || '—' }}</NDescriptionsItem>
        <NDescriptionsItem label="下单时间">{{ order.createdAt }}</NDescriptionsItem>
      </NDescriptions>

      <NDivider />

      <!-- 状态变更 -->
      <h4 style="margin-bottom:12px">状态变更</h4>
      <NSelect
        v-if="statusOptionsMap[order.status]?.length"
        :value="order.status"
        :options="statusOptionsMap[order.status]"
        style="width:160px"
        @update:value="handleStatusChange"
      />
      <span v-else style="color: var(--n-text-color-3); font-size: 14px">该状态不可变更</span>

      <NDivider />

      <!-- 物流信息 -->
      <template v-if="order.status === 'paid' || order.status === 'shipped'">
        <h4 style="margin-bottom:12px">物流信息</h4>
        <NSpace vertical style="max-width: 400px">
          <NInput v-model:value="trackingNo" placeholder="运单号" @blur="handleAutoDetectDetail" />
          <NSpace align="center">
            <NButton size="small" :loading="detectLoadingDetail" @click="handleAutoDetectDetail">
              识别物流公司
            </NButton>
            <span v-if="detectMessageDetail" style="font-size:13px; color: var(--n-text-color-3)">
              {{ detectMessageDetail }}
            </span>
          </NSpace>
          <NSelect
            v-if="detectedCarriersDetail.length > 1"
            v-model:value="shippingCompany"
            :options="detectedCarriersDetail"
            placeholder="选择物流公司"
            filterable
            tag
          />
          <NInput v-else v-model:value="shippingCompany" placeholder="物流公司" />
          <NButton type="primary" :loading="shippingLoading" @click="handleSaveShipping">保存物流信息</NButton>
        </NSpace>
        <NDivider />
      </template>

      <h4 style="margin-bottom:12px">商品明细</h4>
      <NDataTable :columns="itemColumns" :data="order.items || []" :row-key="(r: any) => r.id" />
    </template>
  </NCard>
</template>

<style scoped></style>
