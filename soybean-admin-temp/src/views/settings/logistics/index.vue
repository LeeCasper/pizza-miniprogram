<script setup lang="ts">
import { ref, onMounted } from 'vue';
import {
  NButton,
  NSpace,
  NCard,
  NForm,
  NFormItem,
  NInput,
  NSwitch,
  useMessage,
} from 'naive-ui';
import {
  fetchLogisticsSettings,
  fetchUpdateLogisticsSettings,
} from '@/service/api';

defineOptions({ name: 'SettingsLogistics' });

const message = useMessage();
const loading = ref(false);
const saving = ref(false);

const form = ref({
  enabled: false,
  customer: '',
  key: '',
});

const keyModified = ref(false);

onMounted(async () => {
  loading.value = true;
  const { data, error } = await fetchLogisticsSettings();
  if (!error && data) {
    form.value.enabled = data.enabled || false;
    form.value.customer = data.customer || '';
    form.value.key = data.key || '';
  }
  loading.value = false;
});

function onKeyInput() {
  keyModified.value = true;
}

async function handleSave() {
  saving.value = true;
  const payload: Record<string, any> = {
    enabled: form.value.enabled,
    customer: form.value.customer,
  };
  // Only send key if user modified it (not the masked "****")
  if (keyModified.value && form.value.key) {
    payload.key = form.value.key;
  }

  const { error } = await fetchUpdateLogisticsSettings(payload);
  if (!error) {
    message.success('物流配置已保存');
    keyModified.value = false;
    // Reload to get updated masked value
    const { data } = await fetchLogisticsSettings();
    if (data) {
      form.value.key = data.key || '';
    }
  } else {
    message.error('保存失败');
  }
  saving.value = false;
}
</script>

<template>
  <NSpace vertical :size="16">
    <NCard title="物流查询配置（快递100）" :bordered="false">
      <NForm label-placement="left" label-width="140" :model="form">
        <NFormItem label="启用物流查询">
          <NSwitch v-model:value="form.enabled" />
          <span class="ml-3 text-gray-400 text-xs">开启后，用户可在小程序查看物流轨迹</span>
        </NFormItem>
        <NFormItem label="Customer ID">
          <NInput v-model:value="form.customer" placeholder="请输入快递100 customer ID" />
        </NFormItem>
        <NFormItem label="API Key">
          <NInput
            v-model:value="form.key"
            type="password"
            show-password-on="click"
            placeholder="请输入快递100 API Key"
            @input="onKeyInput"
          />
        </NFormItem>
      </NForm>
      <div class="flex justify-end mt-4">
        <NButton type="primary" :loading="saving" @click="handleSave">
          保存配置
        </NButton>
      </div>
    </NCard>

    <NCard title="接入说明" :bordered="false" size="small">
      <div class="text-13px text-gray-500 leading-relaxed">
        <p class="mb-2">1. 前往 <a href="https://api.kuaidi100.com" target="_blank" class="text-blue-500">快递100开放平台</a> 注册账号</p>
        <p class="mb-2">2. 在管理后台获取 Customer ID 和 API Key</p>
        <p class="mb-2">3. 将凭证填入上方表单并保存</p>
        <p class="mb-2">4. 启用物流查询后，用户在小程序"我的物流"页面可实时追踪快递</p>
        <p>支持的快递公司：顺丰、中通、圆通、申通、韵达、百世、极兔、邮政、EMS、京东、德邦 等 3000+ 家</p>
      </div>
    </NCard>
  </NSpace>
</template>
