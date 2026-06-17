<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { NCard, NGrid, NGridItem, NStatistic, NIcon, NSkeleton } from 'naive-ui';
import { ShoppingCartOutlined, UserOutlined, IdcardOutlined, DollarOutlined, CheckCircleOutlined, ExclamationCircleOutlined, MoneyCollectOutlined, ArrowUpOutlined } from '@vicons/antd';
import { fetchDashboardStats } from '@/service/api';

defineOptions({ name: 'Dashboard' });

interface Stats {
  todayOrders: number;
  totalUsers: number;
  activeCoupons: number;
  todayRevenue: number;
  todayOrdersPaid: number;
  pendingPayments: number;
  rechargeRevenue: number;
  rechargeCount: number;
}

const stats = ref<Stats>({ todayOrders: 0, totalUsers: 0, activeCoupons: 0, todayRevenue: 0, todayOrdersPaid: 0, pendingPayments: 0, rechargeRevenue: 0, rechargeCount: 0 });
const loading = ref(true);

const cards = [
  { label: '今日订单', key: 'todayOrders' as const, icon: ShoppingCartOutlined, color: '#D32F2F' },
  { label: '今日营收', key: 'todayRevenue' as const, icon: DollarOutlined, color: '#388E3C', prefix: '¥' },
  { label: '用户总数', key: 'totalUsers' as const, icon: UserOutlined, color: '#1976D2' },
  { label: '活跃优惠券', key: 'activeCoupons' as const, icon: IdcardOutlined, color: '#388E3C' },
  { label: '已支付订单', key: 'todayOrdersPaid' as const, icon: CheckCircleOutlined, color: '#7B1FA2' },
  { label: '待支付订单', key: 'pendingPayments' as const, icon: ExclamationCircleOutlined, color: '#E65100' },
  { label: '今日充值收入', key: 'rechargeRevenue' as const, icon: MoneyCollectOutlined, color: '#00897B', prefix: '¥' },
  { label: '今日充值笔数', key: 'rechargeCount' as const, icon: ArrowUpOutlined, color: '#5C6BC0' },
];

onMounted(async () => {
  loading.value = true;
  const { data, error } = await fetchDashboardStats();
  if (!error && data) {
    stats.value = data;
  }
  loading.value = false;
});
</script>

<template>
  <div class="dashboard">
    <h2 class="page-title">仪表盘</h2>
    <NGrid :cols="3" :x-gap="16" :y-gap="16" responsive="screen">
      <NGridItem v-for="card in cards" :key="card.key">
        <NCard :bordered="false" class="stat-card">
          <template #cover>
            <div class="stat-cover" :style="{ background: card.color }">
              <NIcon :component="card.icon" size="28" color="#fff" />
            </div>
          </template>
          <NSkeleton v-if="loading" text :repeat="2" />
          <NStatistic v-else :label="card.label" :value="stats[card.key]">
            <template v-if="card.prefix" #prefix>{{ card.prefix }}</template>
          </NStatistic>
        </NCard>
      </NGridItem>
    </NGrid>
  </div>
</template>

<style scoped>
.dashboard { padding: 4px; }
.page-title { margin: 0 0 20px; font-size: 22px; font-weight: 700; color: var(--n-text-color); }
.stat-card { border-radius: 12px; overflow: hidden; }
.stat-cover {
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
