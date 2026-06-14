<script setup lang="ts">
import { ref, computed } from 'vue';
import { NCard, NForm, NFormItem, NInput, NButton, NSpace } from 'naive-ui';
import { useAuthStore } from '@/store/modules/auth';
import { useAppStore } from '@/store/modules/app';
import { useThemeStore } from '@/store/modules/theme';
import { getPaletteColorByNumber, mixColor } from '@sa/color';
import SystemLogo from '@/components/common/system-logo.vue';
import ThemeSchemaSwitch from '@/components/common/theme-schema-switch.vue';

defineOptions({ name: 'Login' });

const authStore = useAuthStore();
const appStore = useAppStore();
const themeStore = useThemeStore();

const username = ref('');
const password = ref('');
const loading = ref(false);

const bgThemeColor = computed(() =>
  themeStore.darkMode ? getPaletteColorByNumber(themeStore.themeColor, 600) : themeStore.themeColor
);

const bgColor = computed(() => {
  const COLOR_WHITE = '#ffffff';
  const ratio = themeStore.darkMode ? 0.5 : 0.2;
  return mixColor(COLOR_WHITE, themeStore.themeColor, ratio);
});

async function handleLogin() {
  if (!username.value || !password.value) {
    window.$message?.warning('请输入用户名和密码');
    return;
  }
  loading.value = true;
  await authStore.login(username.value, password.value);
  loading.value = false;
}
</script>

<template>
  <div class="relative size-full flex-center overflow-hidden" :style="{ backgroundColor: bgColor }">
    <NCard :bordered="false" class="relative z-4 w-auto rd-12px" style="min-width: 380px">
      <div class="login-card">
        <header class="flex-y-center justify-center gap-12px mb-24px">
          <SystemLogo class="size-56px" />
          <h3 class="text-24px text-primary font-600">{{ appStore.title }}</h3>
        </header>

        <ThemeSchemaSwitch
          :theme-schema="themeStore.themeScheme"
          :show-tooltip="false"
          class="text-20px mb-16px flex-center"
          @switch="themeStore.toggleThemeScheme"
        />

        <h3 class="text-16px text-center mb-20px font-500">管理员登录</h3>

        <NForm>
          <NFormItem label="用户名">
            <NInput v-model:value="username" placeholder="请输入用户名" size="large" clearable @keyup.enter="handleLogin" />
          </NFormItem>
          <NFormItem label="密码">
            <NInput v-model:value="password" type="password" placeholder="请输入密码" size="large" show-password-on="click" @keyup.enter="handleLogin" />
          </NFormItem>
          <NFormItem>
            <NButton type="primary" block size="large" :loading="loading" @click="handleLogin">
              登 录
            </NButton>
          </NFormItem>
        </NForm>
      </div>
    </NCard>
  </div>
</template>

<style scoped>
.login-card {
  width: 380px;
  max-width: 90vw;
  padding: 8px;
}
</style>
