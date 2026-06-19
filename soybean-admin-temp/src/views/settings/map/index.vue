<script setup lang="ts">
import { ref, onMounted } from 'vue';
import {
  NButton,
  NCard,
  NForm,
  NFormItem,
  NInput,
  useMessage,
} from 'naive-ui';
import { fetchMapSettings, fetchUpdateMapSettings } from '@/service/api';

defineOptions({ name: 'SettingsMap' });

const message = useMessage();
const loading = ref(false);
const saving = ref(false);

const form = ref({
  tencentKey: '',
});

const keyModified = ref(false);

onMounted(async () => {
  loading.value = true;
  const { data, error } = await fetchMapSettings();
  if (!error && data) {
    form.value.tencentKey = data.tencentKey || '';
  }
  loading.value = false;
});

function onKeyInput() {
  keyModified.value = true;
}

async function handleSave() {
  saving.value = true;
  const payload: Record<string, any> = {};

  if (keyModified.value) {
    payload.tencentKey = form.value.tencentKey;
  }

  const { error } = await fetchUpdateMapSettings(payload);
  if (!error) {
    message.success('地图配置已保存');
    keyModified.value = false;
  } else {
    message.error('保存失败');
  }
  saving.value = false;
}
</script>

<template>
  <NCard title="地图配置" :bordered="false" size="small" class="card-wrapper">
    <template #header-extra>
      <NButton type="primary" size="small" :loading="saving" @click="handleSave">
        保存
      </NButton>
    </template>

    <NForm label-width="160" label-placement="left">
      <NFormItem label="腾讯地图 API Key">
        <NInput
          v-model:value="form.tencentKey"
          type="password"
          show-password-on="click"
          placeholder="请输入腾讯地图 API Key（从 lbs.qq.com 获取）"
          @input="onKeyInput"
        />
      </NFormItem>
    </NForm>
  </NCard>
</template>
