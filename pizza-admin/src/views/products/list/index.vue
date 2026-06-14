<script setup lang="ts">
import { ref, onMounted, h, type Component } from 'vue'
import { useRouter } from 'vue-router'
import { productApi, type Product } from '@/service/api/product'
import AdminLayout from '@/components/AdminLayout.vue'
import { NDataTable, NButton, NTag, NSpace, NImage, useMessage } from 'naive-ui'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@vicons/antd'
import { NIcon } from 'naive-ui'

const router = useRouter()
const message = useMessage()
const products = ref<Product[]>([])
const loading = ref(false)

const columns = [
  { title: 'ID', key: 'id', width: 60 },
  {
    title: '图片', key: 'image', width: 70,
    render(row: Product) {
      return row.image
        ? h(NImage, { src: row.image, width: 40, height: 40, style: { borderRadius: '4px', objectFit: 'cover' } })
        : h('span', { style: { color: '#ccc' } }, '—')
    },
  },
  { title: '名称', key: 'name', ellipsis: { tooltip: true } },
  {
    title: '分类', key: 'category_key', width: 80,
    render(row: Product) {
      const map: Record<string, string> = { pizza: '🍕披萨', durian: '🍈榴莲', pineapple: '🍍菠萝' }
      return map[row.category_key] || row.category_key
    },
  },
  {
    title: '价格', key: 'price', width: 80,
    render(row: Product) { return `¥${row.price}` },
  },
  {
    title: '标签', key: 'tag', width: 90,
    render(row: Product) {
      return row.tag
        ? h(NTag, { size: 'small', type: 'warning', bordered: false }, { default: () => row.tag })
        : '—'
    },
  },
  {
    title: '状态', key: 'is_available', width: 70,
    render(row: Product) {
      return h(NTag, { size: 'small', type: row.is_available ? 'success' : 'default', bordered: false }, {
        default: () => row.is_available ? '在售' : '下架',
      })
    },
  },
  {
    title: '操作', key: 'actions', width: 140,
    render(row: Product) {
      return h(NSpace, null, {
        default: () => [
          h(NButton, { size: 'tiny', quaternary: true, onClick: () => router.push(`/products/${row.id}/edit`) }, {
            default: () => '编辑',
          }),
          h(NButton, {
            size: 'tiny', quaternary: true, type: 'error',
            onClick: () => handleDelete(row),
          }, { default: () => '下架' }),
        ],
      })
    },
  },
]

onMounted(fetchData)

async function fetchData() {
  loading.value = true
  try {
    const res = await productApi.list()
    if (res.code === 0) products.value = res.data
  } catch { message.error('加载商品列表失败') }
  finally { loading.value = false }
}

async function handleDelete(row: Product) {
  try {
    await productApi.remove(row.id)
    message.success('已下架')
    fetchData()
  } catch { message.error('操作失败') }
}
</script>

<template>
  <AdminLayout>
    <div class="page-header">
      <h2 class="page-title">商品管理</h2>
      <NButton type="primary" @click="router.push('/products/create')">
        <template #icon><NIcon><PlusOutlined /></NIcon></template>
        新建商品
      </NButton>
    </div>
    <NDataTable :columns="columns" :data="products" :loading="loading" :row-key="(r: Product) => r.id" />
  </AdminLayout>
</template>

<style scoped>
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.page-title { margin: 0; font-size: 20px; font-weight: 600; }
</style>
