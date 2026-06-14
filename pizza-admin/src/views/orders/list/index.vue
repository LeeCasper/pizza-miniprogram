<script setup lang="ts">
import { ref, onMounted, h } from 'vue'
import { useRouter } from 'vue-router'
import { orderApi } from '@/service/api/order'
import AdminLayout from '@/components/AdminLayout.vue'
import { NDataTable, NTag, NButton, NButtonGroup, NSpace, useMessage } from 'naive-ui'

const router = useRouter()
const message = useMessage()
const orders = ref<any[]>([])
const loading = ref(false)
const activeStatus = ref('all')

const statusTabs = [
  { label: '全部', value: 'all' },
  { label: '待处理', value: 'waiting' },
  { label: '制作中', value: 'preparing' },
  { label: '已完成', value: 'completed' },
  { label: '已取消', value: 'cancelled' },
]

const statusMap: Record<string, { label: string; type: 'warning' | 'info' | 'success' | 'error' | 'default' }> = {
  waiting: { label: '待处理', type: 'warning' },
  preparing: { label: '制作中', type: 'info' },
  completed: { label: '已完成', type: 'success' },
  cancelled: { label: '已取消', type: 'error' },
}

const columns = [
  { title: '订单号', key: 'id', width: 160, ellipsis: { tooltip: true } },
  { title: '用户', key: 'userName', width: 100, ellipsis: { tooltip: true } },
  {
    title: '状态', key: 'status', width: 80,
    render(row: any) {
      const s = statusMap[row.status] || { label: row.status, type: 'default' as const }
      return h(NTag, { size: 'small', type: s.type, bordered: false }, { default: () => s.label })
    },
  },
  {
    title: '金额', key: 'total', width: 80,
    render(row: any) { return `¥${Number(row.total).toFixed(2)}` },
  },
  { title: '取餐码', key: 'pickupCode', width: 80 },
  { title: '时间', key: 'createdAt', width: 160, ellipsis: { tooltip: true } },
  {
    title: '操作', key: 'actions', width: 60,
    render(row: any) {
      return h(NButton, { size: 'tiny', quaternary: true, onClick: () => router.push(`/orders/${row.id}`) }, {
        default: () => '详情',
      })
    },
  },
]

onMounted(fetchData)

async function fetchData() {
  loading.value = true
  try {
    const res = await orderApi.list({ status: activeStatus.value === 'all' ? undefined : activeStatus.value })
    if (res.code === 0) orders.value = res.data
  } catch { message.error('加载订单失败') }
  finally { loading.value = false }
}

function handleStatusChange(status: string) {
  activeStatus.value = status
  fetchData()
}
</script>

<template>
  <AdminLayout>
    <h2 class="page-title">订单管理</h2>
    <div class="status-tabs">
      <NButtonGroup>
        <NButton
          v-for="tab in statusTabs"
          :key="tab.value"
          :type="activeStatus === tab.value ? 'primary' : 'default'"
          size="small"
          @click="handleStatusChange(tab.value)"
        >
          {{ tab.label }}
        </NButton>
      </NButtonGroup>
    </div>
    <NDataTable :columns="columns" :data="orders" :loading="loading" :row-key="(r: any) => r.id" />
  </AdminLayout>
</template>

<style scoped>
.page-title { margin: 0 0 16px; font-size: 20px; font-weight: 600; }
.status-tabs { margin-bottom: 16px; }
</style>
