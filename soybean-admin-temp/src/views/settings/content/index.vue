<script setup lang="ts">
import { ref, onMounted } from 'vue';
import {
  NButton,
  NCard,
  NTabs,
  NTabPane,
  NInput,
  NSpace,
  NSpin,
  useMessage,
} from 'naive-ui';
import { fetchContentSettings, fetchUpdateContentSettings } from '@/service/api';
import type { ContentItem } from '@/service/api';

defineOptions({ name: 'SettingsContent' });

const message = useMessage();
const loading = ref(false);
const saving = ref(false);
const items = ref<ContentItem[]>([]);
const activeKey = ref('content_about');

const TAB_MAP: Record<string, string> = {
  content_about: '关于我们',
  content_agreement: '用户协议',
  content_privacy: '隐私政策',
};

const TAB_KEYS = ['content_about', 'content_agreement', 'content_privacy'] as const;

function placeholderText(key: string): string {
  return `请输入${TAB_MAP[key] || key}内容，支持 HTML`;
}

function saveButtonText(key: string): string {
  return `保存${TAB_MAP[key] || key}`;
}

onMounted(async () => {
  loading.value = true;
  const { data, error } = await fetchContentSettings();
  if (!error && data) {
    items.value = data;
  }
  loading.value = false;
});

function getValue(key: string): string {
  return items.value.find(i => i.config_key === key)?.config_value || '';
}

function setValue(key: string, value: string) {
  const item = items.value.find(i => i.config_key === key);
  if (item) item.config_value = value;
}

async function handleSave(key: string) {
  saving.value = true;
  const value = getValue(key);
  const { error } = await fetchUpdateContentSettings(key, value);
  if (!error) {
    message.success('保存成功');
  }
  saving.value = false;
}
</script>

<template>
  <NSpin :show="loading">
    <NCard title="内容管理" :bordered="false" size="small" class="content-settings-card">
      <NTabs v-model:value="activeKey" type="line" animated>
        <NTabPane v-for="key in TAB_KEYS"
          :key="key" :name="key" :tab="TAB_MAP[key]">
          <NSpace vertical :size="16" class="w-full">
            <NInput
              type="textarea"
              :value="getValue(key)"
              @update:value="(v) => setValue(key, v)"
              :placeholder="placeholderText(key)"
              :autosize="{ minRows: 15, maxRows: 40 }"
              class="content-textarea"
            />
            <NButton type="primary" :loading="saving" @click="handleSave(key)">
              {{ saveButtonText(key) }}
            </NButton>
          </NSpace>
        </NTabPane>
      </NTabs>
    </NCard>
  </NSpin>
</template>

<style scoped>
.w-full {
  width: 100%;
}
.content-textarea {
  font-family: monospace;
}
</style>
