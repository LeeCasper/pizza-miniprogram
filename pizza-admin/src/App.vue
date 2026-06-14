<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'
import { NMessageProvider } from 'naive-ui'

const auth = useAuthStore()
const router = useRouter()

// Auto-redirect to login if no token on protected pages
if (!auth.token && router.currentRoute.value.path !== '/login') {
  router.replace('/login')
}
</script>

<template>
  <NMessageProvider>
    <router-view />
  </NMessageProvider>
</template>
