<script setup lang="ts">
import { ref, onMounted } from 'vue';
import {
  NButton,
  NSpace,
  NCard,
  NForm,
  NFormItem,
  NInput,
  NAlert,
  useMessage,
} from 'naive-ui';
import { fetchPaySettings, fetchUpdatePaySettings } from '@/service/api';

defineOptions({ name: 'SettingsPay' });

const message = useMessage();
const loading = ref(false);
const saving = ref(false);

const form = ref({
  mchId: '',
  apiV3Key: '',
  certSerialNo: '',
  privateKey: '',
  platformCert: '',
  notifyUrl: '',
  refundNotifyUrl: '',
});

// Track whether cert PEM content was modified
const privateKeyModified = ref(false);
const platformCertModified = ref(false);
const apiV3KeyModified = ref(false);

onMounted(async () => {
  loading.value = true;
  const { data, error } = await fetchPaySettings();
  if (!error && data) {
    form.value.mchId = data.mchId || '';
    form.value.apiV3Key = data.apiV3Key || '';
    form.value.certSerialNo = data.certSerialNo || '';
    form.value.privateKey = data.privateKey || '';
    form.value.platformCert = data.platformCert || '';
    form.value.notifyUrl = data.notifyUrl || 'https://artaides.com/api/v1/pay/notify';
    form.value.refundNotifyUrl = data.refundNotifyUrl || '';
  }
  loading.value = false;
});

function onPrivateKeyInput() {
  privateKeyModified.value = true;
}

function onPlatformCertInput() {
  platformCertModified.value = true;
}

function onApiV3KeyInput() {
  apiV3KeyModified.value = true;
}

async function handleSave() {
  saving.value = true;
  const payload: Record<string, string> = {
    mchId: form.value.mchId,
    certSerialNo: form.value.certSerialNo,
    notifyUrl: form.value.notifyUrl,
    refundNotifyUrl: form.value.refundNotifyUrl,
  };

  // Only send key if modified (not the masked placeholder)
  if (apiV3KeyModified.value) {
    payload.apiV3Key = form.value.apiV3Key;
  }

  // Only send cert PEM if modified
  if (privateKeyModified.value) {
    payload.privateKey = form.value.privateKey;
  }

  if (platformCertModified.value) {
    payload.platformCert = form.value.platformCert;
  }

  const { error } = await fetchUpdatePaySettings(payload as any);
  saving.value = false;

  if (!error) {
    message.success('支付配置已保存，立即生效');
    // Reset modified flags after save
    privateKeyModified.value = false;
    platformCertModified.value = false;
    apiV3KeyModified.value = false;
  } else {
    message.error('保存失败，请重试');
  }
}
</script>

<template>
  <NSpace vertical size="large">
    <NCard title="支付配置" :bordered="false" size="small" class="card-wrapper">
      <template #header-extra>
        <NButton type="primary" :loading="saving" @click="handleSave">保存配置</NButton>
      </template>

      <NAlert type="info" :bordered="false" class="mb-4">
        <template #header>配置说明</template>
        填写微信支付商户号、API v3 密钥、证书等凭证。保存后立即生效，无需重启服务器。密钥和证书内容不会完整回显，修改时重新粘贴即可。
      </NAlert>

      <NForm
        ref="formRef"
        :model="form"
        label-placement="left"
        label-width="120"
        require-mark-placement="right-hanging"
        :style="{ maxWidth: '700px' }"
      >
        <NFormItem label="商户号" path="mchId">
          <NInput v-model:value="form.mchId" placeholder="微信支付商户号" />
        </NFormItem>

        <NFormItem label="API v3 密钥" path="apiV3Key">
          <NInput
            v-model:value="form.apiV3Key"
            type="password"
            show-password-on="click"
            placeholder="32位API v3密钥"
            @input="onApiV3KeyInput"
          />
        </NFormItem>

        <NFormItem label="证书序列号" path="certSerialNo">
          <NInput v-model:value="form.certSerialNo" placeholder="商户API证书序列号" />
        </NFormItem>

        <NFormItem label="商户私钥" path="privateKey">
          <NInput
            v-model:value="form.privateKey"
            type="textarea"
            :rows="5"
            placeholder="粘贴 PEM 格式商户私钥内容"
            :input-props="{ style: { fontFamily: 'monospace', fontSize: '12px' } }"
            @input="onPrivateKeyInput"
          />
        </NFormItem>

        <NFormItem label="平台证书" path="platformCert">
          <NInput
            v-model:value="form.platformCert"
            type="textarea"
            :rows="5"
            placeholder="粘贴 PEM 格式微信支付平台证书内容"
            :input-props="{ style: { fontFamily: 'monospace', fontSize: '12px' } }"
            @input="onPlatformCertInput"
          />
        </NFormItem>

        <NFormItem label="回调 URL" path="notifyUrl">
          <NInput v-model:value="form.notifyUrl" placeholder="支付结果通知地址" />
        </NFormItem>

        <NFormItem label="退款回调 URL" path="refundNotifyUrl">
          <NInput v-model:value="form.refundNotifyUrl" placeholder="退款结果通知地址" />
        </NFormItem>
      </NForm>
    </NCard>
  </NSpace>
</template>

<style scoped>
.mb-4 {
  margin-bottom: 16px;
}
</style>
