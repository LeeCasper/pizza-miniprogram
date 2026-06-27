<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
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
const icpBeian = ref('');
const gonganBeian = ref('');

const gonganRecordUrl = computed(() => {
  const text = gonganBeian.value;
  if (!text) return '';
  // Extract the numeric record code from the beian text
  const digits = text.replace(/\D/g, '');
  if (!digits) return '';
  return `http://www.beian.gov.cn/portal/registerSystemInfo?recordcode=${digits}`;
});

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

onMounted(async () => {
  try {
    const resp = await fetch('/api/v1/config/beian');
    if (resp.ok) {
      const { data } = await resp.json();
      if (data) {
        icpBeian.value = data.icpBeian || '';
        gonganBeian.value = data.gonganBeian || '';
      }
    }
  } catch {
    // Non-critical — silently ignore if API is unreachable
  }
});
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

    <!-- ICP & 公安备案 -->
    <div
      v-if="icpBeian || gonganBeian"
      class="absolute bottom-16px left-0 right-0 flex-center flex-col gap-4px text-12px"
      style="color: var(--n-text-color-3)"
    >
      <div v-if="icpBeian" class="flex-center gap-4px">
        <a
          href="https://beian.miit.gov.cn/"
          target="_blank"
          rel="noopener noreferrer"
          style="color: inherit; text-decoration: none"
          class="hover:text-primary transition-colors"
        >
          {{ icpBeian }}
        </a>
      </div>
      <div v-if="gonganBeian" class="flex-center gap-4px">
        <span class="inline-block w-14px h-14px flex-shrink-0">
          <svg viewBox="0 0 128 128" width="100%" height="100%" fill="currentColor" opacity="0.5">
            <path d="M64 8L16 32v32c0 44.2 20.5 85.4 48 96 27.5-10.6 48-51.8 48-96V32L64 8z" fill="#1367C8"/>
            <path d="M64 20.5L23.5 41v25c0 39.6 18.7 76.6 40.5 85.4 21.8-8.8 40.5-45.8 40.5-85.4V41L64 20.5z" fill="#FFF"/>
            <text x="64" y="82" text-anchor="middle" font-size="36" font-weight="bold" fill="#1367C8">公</text>
            <text x="64" y="112" text-anchor="middle" font-size="14" font-weight="bold" fill="#1367C8">安</text>
          </svg>
        </span>
        <a
          :href="gonganRecordUrl"
          target="_blank"
          rel="noopener noreferrer"
          style="color: inherit; text-decoration: none"
          class="hover:text-primary transition-colors"
        >
          {{ gonganBeian }}
        </a>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-card {
  width: 380px;
  max-width: 90vw;
  padding: 8px;
}
</style>
