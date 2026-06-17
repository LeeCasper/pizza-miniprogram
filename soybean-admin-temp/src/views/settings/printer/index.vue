<script setup lang="ts">
import { ref, onMounted } from 'vue';
import {
  NButton,
  NSpace,
  NCard,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NSwitch,
  NAlert,
  useMessage,
} from 'naive-ui';
import {
  fetchPrinterSettings,
  fetchUpdatePrinterSettings,
  fetchTestPrinter,
} from '@/service/api';

defineOptions({ name: 'SettingsPrinter' });

const message = useMessage();
const loading = ref(false);
const saving = ref(false);
const testing = ref(false);

const form = ref({
  enabled: false,
  appId: '',
  appSecret: '',
  sn: '',
  pkey: '',
  apiBase: 'https://open.spyun.net',
  copies: 1,
});

const appSecretModified = ref(false);
const pkeyModified = ref(false);

onMounted(async () => {
  loading.value = true;
  const { data, error } = await fetchPrinterSettings();
  if (!error && data) {
    form.value.enabled = data.enabled || false;
    form.value.appId = data.appId || '';
    form.value.appSecret = data.appSecret || '';
    form.value.sn = data.sn || '';
    form.value.pkey = data.pkey || '';
    form.value.apiBase = data.apiBase || 'https://open.spyun.net';
    form.value.copies = data.copies || 1;
  }
  loading.value = false;
});

function onAppSecretInput() {
  appSecretModified.value = true;
}

function onPkeyInput() {
  pkeyModified.value = true;
}

async function handleSave() {
  saving.value = true;
  const payload: Record<string, any> = {
    enabled: form.value.enabled,
    appId: form.value.appId,
    sn: form.value.sn,
    apiBase: form.value.apiBase,
    copies: form.value.copies,
  };

  if (appSecretModified.value) {
    payload.appSecret = form.value.appSecret;
  }

  if (pkeyModified.value) {
    payload.pkey = form.value.pkey;
  }

  const { error } = await fetchUpdatePrinterSettings(payload);
  if (!error) {
    message.success('打印机配置已保存');
    appSecretModified.value = false;
  } else {
    message.error('保存失败');
  }
  saving.value = false;
}

async function handleTestPrint() {
  testing.value = true;
  const { data, error } = await fetchTestPrinter();
  if (!error && data) {
    message.success('测试打印已发送，请检查打印机');
  } else {
    const errMsg = (data as any)?.message || '测试打印失败';
    message.error(errMsg);
  }
  testing.value = false;
}
</script>

<template>
  <NSpace vertical size="large">
    <NCard title="打印机配置" :bordered="false" size="small">
      <template #header-extra>
        <NButton type="primary" size="small" :loading="saving" @click="handleSave">
          保存
        </NButton>
      </template>

      <NAlert
        v-if="!form.enabled"
        type="warning"
        title="打印机未启用"
        style="margin-bottom: 24px"
      >
        请开启下方开关并填写打印机信息后保存。
        打印机支持商鹏云打印（spyun.net.cn），使用前请先在商鹏开放平台获取 appId 和 appSecret。
      </NAlert>

      <NForm label-width="120" label-placement="left">
        <NFormItem label="启用打印机">
          <NSwitch v-model:value="form.enabled" />
        </NFormItem>

        <NFormItem label="API 地址">
          <NInput v-model:value="form.apiBase" placeholder="https://www.spyun.net.cn" />
        </NFormItem>

        <NFormItem label="App ID">
          <NInput v-model:value="form.appId" placeholder="商鹏开放平台获取" />
        </NFormItem>

        <NFormItem label="App Secret">
          <NInput
            v-model:value="form.appSecret"
            type="password"
            show-password-on="click"
            placeholder="商鹏开放平台获取"
            @input="onAppSecretInput"
          />
        </NFormItem>

        <NFormItem label="打印机 SN">
          <NInput v-model:value="form.sn" placeholder="打印机底部标签上的序列号" />
        </NFormItem>

        <NFormItem label="设备 KEY">
          <NInput
            v-model:value="form.pkey"
            type="password"
            show-password-on="click"
            placeholder="打印机底部标签上的 KEY"
            @input="onPkeyInput"
          />
        </NFormItem>

        <NFormItem label="打印份数">
          <NInputNumber v-model:value="form.copies" :min="1" :max="5" />
        </NFormItem>
      </NForm>
    </NCard>

    <NCard title="测试打印" :bordered="false" size="small">
      <p style="color: var(--n-text-color-2); margin-bottom: 16px">
        发送一张测试小票到打印机，用于验证配置是否正确。
      </p>
      <NButton type="primary" :loading="testing" @click="handleTestPrint" :disabled="!form.sn">
        发送测试打印
      </NButton>
    </NCard>
  </NSpace>
</template>
