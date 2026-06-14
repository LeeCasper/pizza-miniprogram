<script setup lang="ts">
import { ref, onMounted, h } from 'vue';
import { NDataTable, NTag } from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import { fetchCoupons } from '@/service/api';

defineOptions({ name: 'CouponList' });

const coupons = ref<any[]>([]);
const loading = ref(false);

const columns: DataTableColumns<any> = [
  { title: 'ID', key: 'id', width: 60 },
  { title: '用户', key: 'userName', width: 100 },
  { title: '券名', key: 'couponName', width: 140 },
  { title: '类型', key: 'category', width: 80,
    render(row) { return row.category === 'redeem' ? '兑换券' : '优惠券'; }
  },
  { title: '码', key: 'code', width: 120 },
  { title: '面值', key: 'value', width: 80 },
  {
    title: '状态', key: 'status', width: 80,
    render(row) {
      const map: Record<string, { label: string; type: 'success' | 'warning' | 'error' | 'default' }> = {
        unused: { label: '未使用', type: 'success' },
        used: { label: '已使用', type: 'default' },
        expired: { label: '已过期', type: 'error' },
      };
      const s = map[row.status] || { label: row.status, type: 'default' as const };
      return h(NTag, { type: s.type, size: 'small', bordered: false }, () => s.label);
    }
  },
  { title: '有效期', key: 'expireAt', width: 120 },
];

async function loadCoupons() {
  loading.value = true;
  const { data, error } = await fetchCoupons();
  if (!error && data) {
    coupons.value = Array.isArray(data) ? data : data.list || [];
  }
  loading.value = false;
}

onMounted(() => { loadCoupons(); });
</script>

<template>
  <div class="coupon-list">
    <h2 class="page-title">优惠券</h2>
    <NDataTable :columns="columns" :data="coupons" :loading="loading" :row-key="(r: any) => r.id" />
  </div>
</template>

<style scoped>
.coupon-list { padding: 4px; }
.page-title { margin: 0 0 16px; font-size: 22px; font-weight: 700; }
</style>
