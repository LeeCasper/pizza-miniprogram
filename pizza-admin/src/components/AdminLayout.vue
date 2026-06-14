<script setup lang="ts">
import { h, ref, type Component } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import {
  NLayout, NLayoutSider, NLayoutContent, NLayoutHeader,
  NMenu, NButton, NIcon, NSpace, NTag, NDropdown,
} from 'naive-ui'
import {
  DashboardOutlined, ShoppingOutlined, FileTextOutlined,
  IdcardOutlined, UserOutlined, GiftOutlined,
  MenuOutlined, LogoutOutlined,
} from '@vicons/antd'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const collapsed = ref(false)

function renderIcon(icon: Component) {
  return () => h(NIcon, null, { default: () => h(icon) })
}

const menuOptions = [
  { label: '仪表盘', key: '/dashboard', icon: renderIcon(DashboardOutlined) },
  { label: '商品管理', key: '/products', icon: renderIcon(ShoppingOutlined) },
  { label: '订单管理', key: '/orders', icon: renderIcon(FileTextOutlined) },
  { label: '优惠券', key: '/coupons', icon: renderIcon(IdcardOutlined) },
  { label: '用户管理', key: '/users', icon: renderIcon(UserOutlined) },
  { label: '积分商城', key: '/points', icon: renderIcon(GiftOutlined) },
]

function handleMenuUpdate(key: string) {
  router.push(key)
}

function handleLogout() {
  auth.logout()
  router.replace('/login')
}
</script>

<template>
  <NLayout class="layout-root">
    <NLayoutSider
      bordered
      :collapsed="collapsed"
      collapse-mode="width"
      :collapsed-width="64"
      :width="220"
      class="sidebar"
    >
      <div class="logo">
        <span class="logo-icon">🍕</span>
        <span v-if="!collapsed" class="logo-text">王姐披萨·管理</span>
      </div>
      <NMenu
        :options="menuOptions"
        :value="route.path"
        :collapsed="collapsed"
        :collapsed-icon-size="22"
        @update:value="handleMenuUpdate"
      />
    </NLayoutSider>

    <NLayout>
      <NLayoutHeader bordered class="header">
        <NSpace align="center">
          <NButton quaternary @click="collapsed = !collapsed">
            <template #icon>
              <NIcon><MenuOutlined /></NIcon>
            </template>
          </NButton>
        </NSpace>
        <NSpace align="center">
          <NTag type="info" size="small">
            {{ auth.user?.displayName || auth.user?.username }}
          </NTag>
          <NButton quaternary size="small" @click="handleLogout">
            <template #icon>
              <NIcon><LogoutOutlined /></NIcon>
            </template>
            退出
          </NButton>
        </NSpace>
      </NLayoutHeader>

      <NLayoutContent class="content">
        <slot />
      </NLayoutContent>
    </NLayout>
  </NLayout>
</template>

<style scoped>
.layout-root {
  height: 100vh;
}
.sidebar {
  background: #fff;
}
.logo {
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-bottom: 1px solid #f0f0f0;
}
.logo-icon {
  font-size: 22px;
}
.logo-text {
  font-size: 14px;
  font-weight: 700;
  color: #D32F2F;
  white-space: nowrap;
}
.header {
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  background: #fff;
}
.content {
  padding: 24px;
  background: #f5f5f5;
  min-height: calc(100vh - 56px);
}
</style>
