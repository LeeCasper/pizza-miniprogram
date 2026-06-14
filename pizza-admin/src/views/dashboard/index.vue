<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { dashboardApi } from '@/service/api/dashboard'
import AdminLayout from '@/components/AdminLayout.vue'
import { NCard, NGrid, NGi, NStatistic, NIcon } from 'naive-ui'
import { FileTextOutlined, UserOutlined, IdcardOutlined } from '@vicons/antd'

const stats = ref({ todayOrders: 0, totalUsers: 0, activeCoupons: 0 })

onMounted(async () => {
  try {
    const res = await dashboardApi.getStats()
    if (res.code === 0) stats.value = res.data
  } catch {}
})
</script>

<template>
  <AdminLayout>
    <h2 class="page-title">仪表盘</h2>
    <NGrid cols="1 s:2 m:3" :x-gap="16" :y-gap="16">
      <NGi>
        <NCard>
          <NStatistic label="今日订单">
            <template #prefix>
              <NIcon><FileTextOutlined /></NIcon>
            </template>
            {{ stats.todayOrders }}
          </NStatistic>
        </NCard>
      </NGi>
      <NGi>
        <NCard>
          <NStatistic label="用户总数">
            <template #prefix>
              <NIcon><UserOutlined /></NIcon>
            </template>
            {{ stats.totalUsers }}
          </NStatistic>
        </NCard>
      </NGi>
      <NGi>
        <NCard>
          <NStatistic label="活跃优惠券">
            <template #prefix>
              <NIcon><IdcardOutlined /></NIcon>
            </template>
            {{ stats.activeCoupons }}
          </NStatistic>
        </NCard>
      </NGi>
    </NGrid>
  </AdminLayout>
</template>

<style scoped>
.page-title {
  margin: 0 0 20px;
  font-size: 20px;
  font-weight: 600;
}
</style>
