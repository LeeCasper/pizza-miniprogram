<script setup lang="ts">
import { ref, onMounted, h } from 'vue'
import { couponApi } from '@/service/api/coupon'
import AdminLayout from '@/components/AdminLayout.vue'
import { NDataTable, NTag, useMessage } from 'naive-ui'

const message = useMessage()
const coupons = ref<any[]>([])
const loading = ref(false)

const statusMap: Record<string, { label: string; type: 'success' | 'error' | 'default' }> = {
  available: { label: '可用', type: 'success' },
  used: { label: '已使用', type: 'default' },
  expired: { label: '已过期', type: 'error' },
}

const columns = [
  { title: 'ID', key: 'id', width: 60 },
  { title: '用户', key: 'userName', width: 100, ellipsis: { tooltip: true } },
  { title: '券名', key: 'name', ellipsis: { tooltip: true } },
  {
    title: '类型', key: 'categoryLabel', width: 80,
    render(row: any) {
      return h(NTag, { size: 'small', type: row.category === 'redeem' ? 'info' : 'warning', bordered: false }, {
        default: () => row.categoryLabel,
      })
    },
  },
  { title: '券码', key: 'code', width: 130, ellipsis: { tooltip: true } },
  {
    title: '状态', key: 'status', width: 80,
    render(row: any) {
      const s = statusMap[row.status] || { label: row.status, type: 'default' as const }
      return h(NTag, { size: 'small', type: s.type, bordered: false }, { default: () => s.label })
    },
  },
  { title: '有效期', key: 'validFrom', width: 180, ellipsis: { tooltip: true },
    render(row: any) { return `${row.validFrom?.slice(0,10)} ~ ${row.validTo?.slice(0,10)}` },
  },
]

onMounted(fetchData)

async function fetchData() {
  loading.value = true
  try {
    const res = await couponApi.list()
    if (res.code === 0) coupons.value = res.data
  } catch { message.error('加载优惠券失败') }
  finally { loading.value = false }
}
</script>

<template>
  <AdminLayout>
    <h2 class="page-title">优惠券管理</h2>
    <NDataTable :columns="columns" :data="coupons" :loading="loading" :row-key="(r: any) => r.id" />
  </AdminLayout>
</template>

<style scoped>
.page-title { margin: 0 0 16px; font-size: 20px; font-weight: 600; }
</style>
