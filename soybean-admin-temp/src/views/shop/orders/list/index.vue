<script setup lang="ts">
import { ref, onMounted, h } from 'vue';
import { useRouter } from 'vue-router';
import {
  NCard, NDataTable, NTag, NButton, NSpace, NSelect,
  NModal, NForm, NFormItem, NInput,
} from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import { fetchShopOrders, fetchUpdateShopOrderShipping, fetchAutoDetectCarrier } from '@/service/api/shop';
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

// ── Shipping modal state ──
const showShipModal = ref(false);
const shipTarget = ref<any>(null);
const shipForm = ref({ trackingNo: '', shippingCompany: '' });
const detectedCarriers = ref<{ label: string; value: string }[]>([]);
const detectLoading = ref(false);
const shipSubmitting = ref(false);
const detectMessage = ref('');

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
  {
    title: '收货地址', key: 'recipientAddress', width: 180,
    ellipsis: { tooltip: true },
  },
  { title: '下单时间', key: 'createdAt', width: 160 },
  {
    title: '', key: 'actions', width: 120,
    render(row) {
      return h(NSpace, null, {
        default: () => [
          row.status === 'paid'
            ? h(NButton, { size: 'small', type: 'primary', onClick: () => openShipModal(row) }, () => '发货')
            : null,
          h(NButton, { size: 'small', onClick: () => router.push(`/shop/orders/${row.id}`) }, () => '详情'),
        ],
      });
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

// ── Shipping modal ──
function openShipModal(order: any) {
  shipTarget.value = order;
  shipForm.value = { trackingNo: '', shippingCompany: '' };
  detectedCarriers.value = [];
  detectMessage.value = '';
  showShipModal.value = true;
}

async function handleAutoDetect() {
  if (!shipForm.value.trackingNo.trim()) {
    window.$message?.warning('请先输入运单号');
    return;
  }
  detectLoading.value = true;
  detectMessage.value = '';
  detectedCarriers.value = [];
  const { data, error } = await fetchAutoDetectCarrier(shipForm.value.trackingNo.trim());
  detectLoading.value = false;
  if (error || !data) {
    detectMessage.value = '识别失败，请手动选择物流公司';
    return;
  }
  const carriers = (data.auto?.length ? data.auto : data.com) || [];
  if (carriers.length === 0) {
    detectMessage.value = '未识别到物流公司，请手动输入';
    return;
  }
  detectedCarriers.value = carriers.map((c: any) => ({
    label: c.name || c.comCode,
    value: c.name || c.comCode,
  }));
  if (carriers.length === 1) {
    shipForm.value.shippingCompany = carriers[0].name || carriers[0].comCode;
    detectMessage.value = `已识别：${carriers[0].name || carriers[0].comCode}`;
  } else {
    detectMessage.value = `识别到 ${carriers.length} 家物流公司，请选择`;
  }
}

function handleCarrierSelect(val: string) {
  shipForm.value.shippingCompany = val;
}

async function handleShipSubmit() {
  if (!shipForm.value.trackingNo.trim()) {
    window.$message?.warning('请填写运单号');
    return;
  }
  if (!shipForm.value.shippingCompany.trim()) {
    window.$message?.warning('请选择或输入物流公司');
    return;
  }
  shipSubmitting.value = true;
  const { error } = await fetchUpdateShopOrderShipping(shipTarget.value.id, {
    shippingCompany: shipForm.value.shippingCompany.trim(),
    trackingNo: shipForm.value.trackingNo.trim(),
  });
  shipSubmitting.value = false;
  if (!error) {
    window.$message?.success('发货成功');
    showShipModal.value = false;
    loadOrders();
  }
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

    <!-- 发货弹窗 -->
    <NModal v-model:show="showShipModal" preset="card" title="发货" style="width: 480px">
      <NForm label-placement="top">
        <NFormItem label="运单号">
          <NInput
            v-model:value="shipForm.trackingNo"
            placeholder="输入快递运单号"
            @blur="handleAutoDetect"
          />
        </NFormItem>
        <NFormItem label="物流公司">
          <NSpace vertical style="width: 100%">
            <NButton
              size="small"
              :loading="detectLoading"
              @click="handleAutoDetect"
            >
              识别物流公司
            </NButton>
            <span v-if="detectMessage" style="font-size: 13px; color: var(--n-text-color-3)">
              {{ detectMessage }}
            </span>
          </NSpace>
          <NSelect
            v-if="detectedCarriers.length > 1"
            v-model:value="shipForm.shippingCompany"
            :options="detectedCarriers"
            placeholder="选择物流公司"
            style="margin-top: 8px"
            filterable
            tag
            @update:value="handleCarrierSelect"
          />
          <NInput
            v-else
            v-model:value="shipForm.shippingCompany"
            placeholder="物流公司名称，如 顺丰速运"
          />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showShipModal = false">取消</NButton>
          <NButton type="primary" :loading="shipSubmitting" @click="handleShipSubmit">
            确认发货
          </NButton>
        </NSpace>
      </template>
    </NModal>
  </NCard>
</template>

<style scoped></style>
