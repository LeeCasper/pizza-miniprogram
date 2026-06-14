<script setup lang="ts">
import { ref, onMounted, h } from 'vue'
import { useRouter } from 'vue-router'
import { pointsApi, type PointsProduct } from '@/service/api/points'
import AdminLayout from '@/components/AdminLayout.vue'
import { NDataTable, NButton, NTag, NSpace, NImage, NIcon, useMessage } from 'naive-ui'
import { PlusOutlined, EditOutlined } from '@vicons/antd'

const router = useRouter()
const message = useMessage()
const products = ref<PointsProduct[]>([])
const loading = ref(false)

const columns = [
  { title: 'ID', key: 'id', width: 60 },
  {
    title: '图片', key: 'image', width: 70,
    render(row: PointsProduct) {
      return row.image
        ? h(NImage, { src: row.image, width: 40, height: 40, style: { borderRadius: '4px', objectFit: 'cover' } })
        : '—'
    },
  },
  { title: '名称', key: 'name', ellipsis: { tooltip: true } },
  {
    title: '积分', key: 'points', width: 70,
    render(row: PointsProduct) { return row.points?.toLocaleString() },
  },
  {
    title: '类型', key: 'redeemType', width: 90,
    render(row: PointsProduct) {
      return h(NTag, { size: 'small', type: row.redeemType === 'coupon' ? 'info' : 'success', bordered: false }, {
        default: () => row.redeemType === 'coupon' ? '兑换券' : '实物',
      })
    },
  },
  {
    title: '库存', key: 'stock', width: 70,
    render(row: PointsProduct) { return row.stock === -1 ? '无限' : String(row.stock) },
  },
  {
    title: '状态', key: 'isActive', width: 70,
    render(row: PointsProduct) {
      return h(NTag, { size: 'small', type: row.isActive ? 'success' : 'default', bordered: false }, {
        default: () => row.isActive ? '启用' : '禁用',
      })
    },
  },
  {
    title: '操作', key: 'actions', width: 80,
    render(row: PointsProduct) {
      return h(NButton, { size: 'tiny', quaternary: true, onClick: () => router.push(`/points/${row.id}/edit`) }, {
        default: () => '编辑',
      })
    },
  },
]

onMounted(fetchData)

async function fetchData() {
  loading.value = true
  try {
    const res = await pointsApi.list()
    if (res.code === 0) products.value = res.data
  } catch { message.error('加载积分商品失败') }
  finally { loading.value = false }
}
</script>

<template>
  <AdminLayout>
    <div class="page-header">
      <h2 class="page-title">积分商城</h2>
      <NButton type="primary" @click="router.push('/points/create')">
        <template #icon><NIcon><PlusOutlined /></NIcon></template>
        新建商品
      </NButton>
    </div>
    <NDataTable :columns="columns" :data="products" :loading="loading" :row-key="(r: PointsProduct) => r.id || 0" />
  </AdminLayout>
</template>

<style scoped>
.page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.page-title { margin: 0; font-size: 20px; font-weight: 600; }
</style>
