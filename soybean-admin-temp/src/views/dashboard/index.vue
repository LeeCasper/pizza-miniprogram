<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { createReusableTemplate } from '@vueuse/core';
import { useAppStore } from '@/store/modules/app';
import { useThemeStore } from '@/store/modules/theme';
import { useEcharts } from '@/hooks/common/echarts';
import { fetchDashboardStats, fetchDashboardCharts } from '@/service/api';
import type { DashboardStats, DashboardCharts } from '@/service/api';

defineOptions({ name: 'Dashboard' });

const appStore = useAppStore();
const themeStore = useThemeStore();
const gap = computed(() => (appStore.isMobile ? 0 : 16));

// ── Data ──────────────────────────────────────────────
const stats = ref<DashboardStats>({
  todayOrders: 0, totalUsers: 0, activeCoupons: 0, todayRevenue: 0,
  todayOrdersPaid: 0, pendingPayments: 0, rechargeRevenue: 0, rechargeCount: 0,
});

// ── Gradient Card Template (1:1 from home/card-data.vue) ──
interface CardItem {
  key: string;
  title: string;
  value: number;
  unit: string;
  color: { start: string; end: string };
  icon: string;
}

const cardRow1 = computed<CardItem[]>(() => [
  {
    key: 'todayOrders', title: '今日订单', value: stats.value.todayOrders, unit: '',
    color: { start: '#ec4786', end: '#b955a4' }, icon: 'ant-design:shopping-cart-outlined',
  },
  {
    key: 'todayRevenue', title: '今日营收', value: stats.value.todayRevenue, unit: '¥',
    color: { start: '#865ec0', end: '#5144b4' }, icon: 'ant-design:dollar-outlined',
  },
  {
    key: 'totalUsers', title: '用户总数', value: stats.value.totalUsers, unit: '',
    color: { start: '#56cdf3', end: '#719de3' }, icon: 'ant-design:user-outlined',
  },
  {
    key: 'activeCoupons', title: '活跃优惠券', value: stats.value.activeCoupons, unit: '',
    color: { start: '#fcbc25', end: '#f68057' }, icon: 'ant-design:gift-outlined',
  },
]);

const cardRow2 = computed<CardItem[]>(() => [
  {
    key: 'todayOrdersPaid', title: '已支付订单', value: stats.value.todayOrdersPaid, unit: '',
    color: { start: '#36d1dc', end: '#5b86e5' }, icon: 'ant-design:check-circle-outlined',
  },
  {
    key: 'pendingPayments', title: '待支付订单', value: stats.value.pendingPayments, unit: '',
    color: { start: '#f7971e', end: '#ffd200' }, icon: 'ant-design:exclamation-circle-outlined',
  },
  {
    key: 'rechargeRevenue', title: '今日充值收入', value: stats.value.rechargeRevenue, unit: '¥',
    color: { start: '#11998e', end: '#38ef7d' }, icon: 'ant-design:money-collect-outlined',
  },
  {
    key: 'rechargeCount', title: '今日充值笔数', value: stats.value.rechargeCount, unit: '',
    color: { start: '#6a11cb', end: '#2575fc' }, icon: 'ant-design:rise-outlined',
  },
]);

interface GradientBgProps { gradientColor: string }
const [DefineGradientBg, GradientBg] = createReusableTemplate<GradientBgProps>();

function getGradientColor(color: CardItem['color']) {
  return `linear-gradient(to bottom right, ${color.start}, ${color.end})`;
}

// ── Bar Chart: 7-day order trend ──────────────────────
const STATUS_LABELS: Record<string, string> = {
  waiting: '待支付', preparing: '制作中', completed: '已完成', cancelled: '已取消',
};
const STATUS_COLORS = ['#5da8ff', '#fcbc25', '#26deca', '#ff6b6b'];

const { domRef: barRef, updateOptions: updateBar } = useEcharts(() => ({
  tooltip: {
    trigger: 'axis' as const,
    axisPointer: { type: 'cross' as const, label: { backgroundColor: '#6a7985' } },
  },
  legend: { data: ['订单数', '营收 (¥)'], top: '0' },
  grid: { left: '3%', right: '4%', bottom: '3%', top: '15%', containLabel: true },
  xAxis: { type: 'category' as const, boundaryGap: true, data: [] as string[] },
  yAxis: [
    { type: 'value' as const, name: '订单数', position: 'left' as const },
    { type: 'value' as const, name: '营收 (¥)', position: 'right' as const },
  ],
  series: [
    {
      name: '订单数', type: 'bar' as const, color: '#8e9dff',
      barWidth: '40%',
      itemStyle: {
        borderRadius: [4, 4, 0, 0],
        color: {
          type: 'linear' as const, x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: '#8e9dff' },
            { offset: 1, color: '#c4b5fd' },
          ],
        },
      },
      data: [] as number[],
    },
    {
      name: '营收 (¥)', type: 'line' as const, yAxisIndex: 1, color: '#26deca',
      smooth: true,
      areaStyle: {
        color: {
          type: 'linear' as const, x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0.25, color: '#26deca' },
            { offset: 1, color: '#fff' },
          ],
        },
      },
      data: [] as number[],
    },
  ],
}));

// ── Pie Chart: order status distribution ──────────────
const { domRef: pieRef, updateOptions: updatePie } = useEcharts(() => ({
  tooltip: { trigger: 'item' as const },
  legend: { bottom: '1%', left: 'center', itemStyle: { borderWidth: 0 } },
  series: [
    {
      color: STATUS_COLORS,
      name: '订单状态',
      type: 'pie' as const,
      radius: ['45%', '75%'],
      avoidLabelOverlap: false,
      itemStyle: { borderRadius: 10, borderColor: '#fff', borderWidth: 1 },
      label: { show: false, position: 'center' as const },
      emphasis: { label: { show: true, fontSize: '12' } },
      labelLine: { show: false },
      data: [] as { name: string; value: number }[],
    },
  ],
}));

// ── Fetch data ────────────────────────────────────────
onMounted(async () => {
  const [statsRes, chartsRes] = await Promise.all([
    fetchDashboardStats(),
    fetchDashboardCharts(),
  ]);

  if (!statsRes.error && statsRes.data) {
    stats.value = statsRes.data;
  }

  if (!chartsRes.error && chartsRes.data) {
    const charts = chartsRes.data as DashboardCharts;

    updateBar(opts => {
      opts.xAxis.data = charts.orderTrend.map(d => d.date.slice(5)); // MM-DD
      opts.series[0].data = charts.orderTrend.map(d => d.orders);
      opts.series[1].data = charts.orderTrend.map(d => d.revenue);
      return opts;
    });

    updatePie(opts => {
      opts.series[0].data = charts.statusDistribution.map(d => ({
        name: STATUS_LABELS[d.status] || d.status,
        value: d.count,
      }));
      return opts;
    });
  }
});
</script>

<template>
  <NSpace vertical :size="16">
    <!-- define component: GradientBg (reusable gradient card background) -->
    <DefineGradientBg v-slot="{ $slots, gradientColor }">
      <div
        class="px-16px pb-4px pt-8px text-white"
        :style="{ backgroundImage: gradientColor, borderRadius: themeStore.themeRadius + 'px' }"
      >
        <component :is="$slots.default" />
      </div>
    </DefineGradientBg>

    <!-- Row 1: 4 primary stat cards -->
    <NCard :bordered="false" size="small" class="card-wrapper">
      <NGrid cols="s:1 m:2 l:4" responsive="screen" :x-gap="16" :y-gap="16">
        <NGi v-for="item in cardRow1" :key="item.key">
          <GradientBg :gradient-color="getGradientColor(item.color)" class="flex-1">
            <h3 class="text-16px">{{ item.title }}</h3>
            <div class="flex justify-between pt-12px">
              <SvgIcon :icon="item.icon" class="text-32px" />
              <CountTo
                :prefix="item.unit"
                :start-value="1"
                :end-value="item.value"
                class="text-30px text-white dark:text-dark"
              />
            </div>
          </GradientBg>
        </NGi>
      </NGrid>
    </NCard>

    <!-- Row 2: 4 secondary stat cards -->
    <NCard :bordered="false" size="small" class="card-wrapper">
      <NGrid cols="s:1 m:2 l:4" responsive="screen" :x-gap="16" :y-gap="16">
        <NGi v-for="item in cardRow2" :key="item.key">
          <GradientBg :gradient-color="getGradientColor(item.color)" class="flex-1">
            <h3 class="text-16px">{{ item.title }}</h3>
            <div class="flex justify-between pt-12px">
              <SvgIcon :icon="item.icon" class="text-32px" />
              <CountTo
                :prefix="item.unit"
                :start-value="1"
                :end-value="item.value"
                class="text-30px text-white dark:text-dark"
              />
            </div>
          </GradientBg>
        </NGi>
      </NGrid>
    </NCard>

    <!-- Charts row: bar chart (wider) + pie chart (narrower) -->
    <NGrid :x-gap="gap" :y-gap="16" responsive="screen" item-responsive>
      <NGi span="24 s:24 m:14">
        <NCard title="近7日订单趋势" :bordered="false" size="small" class="card-wrapper">
          <div ref="barRef" class="h-360px overflow-hidden"></div>
        </NCard>
      </NGi>
      <NGi span="24 s:24 m:10">
        <NCard title="订单状态分布" :bordered="false" size="small" class="card-wrapper">
          <div ref="pieRef" class="h-360px overflow-hidden"></div>
        </NCard>
      </NGi>
    </NGrid>
  </NSpace>
</template>

<style scoped></style>
