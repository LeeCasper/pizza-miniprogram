<template>
  <NCard title="存储配置" :bordered="false" size="small">
    <template #header-extra>
      <NButton type="primary" :loading="saving" @click="handleSave">保存</NButton>
    </template>

    <NSpin :show="loading">
      <NForm label-placement="left" label-width="120" :model="form">
        <NFormItem label="存储方式">
          <NRadioGroup v-model:value="form.storageType" name="storageType">
            <NRadio value="local">本地存储</NRadio>
            <NRadio value="cos">腾讯云 COS</NRadio>
          </NRadioGroup>
        </NFormItem>

        <template v-if="form.storageType === 'cos'">
          <NFormItem label="SecretId">
            <NInput v-model:value="form.cosSecretId" placeholder="腾讯云 API 密钥 SecretId" />
          </NFormItem>
          <NFormItem label="SecretKey">
            <NInput
              v-model:value="form.cosSecretKey"
              type="password"
              placeholder="腾讯云 API 密钥 SecretKey"
              @input="secretKeyModified = true"
            />
          </NFormItem>
          <NFormItem label="Bucket">
            <NInput v-model:value="form.cosBucket" placeholder="my-bucket-1250000000" />
          </NFormItem>
          <NFormItem label="Region">
            <NInput v-model:value="form.cosRegion" placeholder="ap-guangzhou" />
          </NFormItem>
          <NFormItem label="CDN 域名">
            <NInput v-model:value="form.cosBaseUrl" placeholder="https://img.pizza.artaides.com（可选）" />
          </NFormItem>
        </template>
      </NForm>
    </NSpin>
  </NCard>

  <NCard title="配置说明" :bordered="false" size="small" class="mt-4">
    <ul class="text-sm text-gray-500 leading-6">
      <li>切换至「腾讯云 COS」后，新上传的图片将存入 COS 并返回 CDN 加速地址。</li>
      <li>已有图片不受影响，本地和 COS 图片均可正常访问。</li>
      <li>SecretId / SecretKey 从腾讯云控制台 → 访问管理 → API 密钥管理 获取。</li>
      <li>Bucket 格式为「存储桶名称-APPID」，Region 如 ap-guangzhou。</li>
      <li>如绑定了 CDN 加速域名，填写后可替代默认 COS 域名。</li>
    </ul>
  </NCard>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import {
  NCard,
  NButton,
  NSpin,
  NForm,
  NFormItem,
  NInput,
  NRadioGroup,
  NRadio,
  useMessage,
} from 'naive-ui';
import { fetchStorageSettings, fetchUpdateStorageSettings } from '@/service/api';

defineOptions({ name: 'SettingsStorage' });

const message = useMessage();
const loading = ref(false);
const saving = ref(false);
const secretKeyModified = ref(false);

const form = ref({
  storageType: 'local',
  cosSecretId: '',
  cosSecretKey: '',
  cosBucket: '',
  cosRegion: 'ap-guangzhou',
  cosBaseUrl: '',
});

onMounted(async () => {
  loading.value = true;
  const { data, error } = await fetchStorageSettings();
  if (!error && data) {
    form.value.storageType = data.storageType || 'local';
    form.value.cosSecretId = data.cosSecretId || '';
    form.value.cosSecretKey = data.cosSecretKey || '';
    form.value.cosBucket = data.cosBucket || '';
    form.value.cosRegion = data.cosRegion || 'ap-guangzhou';
    form.value.cosBaseUrl = data.cosBaseUrl || '';
  }
  loading.value = false;
});

async function handleSave() {
  saving.value = true;
  const payload: Record<string, any> = {
    storageType: form.value.storageType,
    cosSecretId: form.value.cosSecretId,
    cosBucket: form.value.cosBucket,
    cosRegion: form.value.cosRegion,
    cosBaseUrl: form.value.cosBaseUrl,
  };
  if (secretKeyModified.value && form.value.cosSecretKey) {
    payload.cosSecretKey = form.value.cosSecretKey;
  }
  const { error } = await fetchUpdateStorageSettings(payload);
  if (!error) {
    message.success('存储配置已保存');
    secretKeyModified.value = false;
  } else {
    message.error('保存失败');
  }
  saving.value = false;
}
</script>

<style scoped>
.mt-4 {
  margin-top: 16px;
}
</style>
