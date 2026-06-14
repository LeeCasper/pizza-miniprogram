<script setup lang="ts">
import { ref, onMounted, h } from 'vue'
import { userApi } from '@/service/api/user'
import AdminLayout from '@/components/AdminLayout.vue'
import { NDataTable, NTag, NAvatar, NSpace, useMessage } from 'naive-ui'

const message = useMessage()
const users = ref<any[]>([])
const loading = ref(false)

const tierMap: Record<string, { label: string; type: 'default' | 'warning' | 'info' | 'error' }> = {
  normal: { label: '普通', type: 'default' },
  gold: { label: '黄金', type: 'warning' },
  platinum: { label: '铂金', type: 'info' },
  diamond: { label: '钻石', type: 'error' },
}

const columns = [
  { title: 'ID', key: 'id', width: 60 },
  {
    title: '头像', key: 'avatar', width: 60,
    render(row: any) {
      return h(NAvatar, { src: row.avatar, size: 'small' }, { default: () => row.name?.charAt(0) || '?' })
    },
  },
  { title: '昵称', key: 'name', ellipsis: { tooltip: true } },
  { title: '手机', key: 'phone', width: 120 },
  {
    title: '积分', key: 'points', width: 80,
    render(row: any) { return row.points?.toLocaleString() || '0' },
  },
  {
    title: '等级', key: 'memberLevel', width: 80,
    render(row: any) {
      const t = tierMap[row.memberLevel] || { label: row.memberLevel || '普通', type: 'default' as const }
      return h(NTag, { size: 'small', type: t.type, bordered: false }, { default: () => t.label })
    },
  },
  { title: '订单数', key: 'orderCount', width: 70 },
  { title: '注册时间', key: 'createdAt', width: 160, ellipsis: { tooltip: true } },
]

onMounted(fetchData)

async function fetchData() {
  loading.value = true
  try {
    const res = await userApi.list()
    if (res.code === 0) users.value = res.data
  } catch { message.error('加载用户列表失败') }
  finally { loading.value = false }
}
</script>

<template>
  <AdminLayout>
    <h2 class="page-title">用户管理</h2>
    <NDataTable :columns="columns" :data="users" :loading="loading" :row-key="(r: any) => r.id" />
  </AdminLayout>
</template>

<style scoped>
.page-title { margin: 0 0 16px; font-size: 20px; font-weight: 600; }
</style>
