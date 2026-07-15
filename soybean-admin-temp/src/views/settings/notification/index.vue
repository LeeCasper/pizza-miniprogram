<script setup lang="ts">
import { ref, onMounted } from 'vue';
import {
  NButton,
  NCard,
  NForm,
  NFormItem,
  NInput,
  NSwitch,
  NAlert,
  useMessage,
} from 'naive-ui';
import { fetchNotificationSettings, fetchUpdateNotificationSettings } from '@/service/api';

defineOptions({ name: 'SettingsNotification' });

const message = useMessage();
const loading = ref(false);
const saving = ref(false);

const form = ref({
  orderEnabled: false,
  couponEnabled: false,
  orderTpl: '',
  couponTpl: '',
});

onMounted(async () => {
  loading.value = true;
  const { data, error } = await fetchNotificationSettings();
  if (!error && data) {
    form.value.orderEnabled = data.orderEnabled !== false;
    form.value.couponEnabled = data.couponEnabled !== false;
    form.value.orderTpl = data.orderTpl || '';
    form.value.couponTpl = data.couponTpl || '';
  }
  loading.value = false;
});

async function handleSave() {
  saving.value = true;
  const { error } = await fetchUpdateNotificationSettings({
    orderEnabled: form.value.orderEnabled,
    couponEnabled: form.value.couponEnabled,
    orderTpl: form.value.orderTpl,
    couponTpl: form.value.couponTpl,
  });
  if (!error) {
    message.success('保存成功');
  }
  saving.value = false;
}
</script>

<template>
  <NCard title="订阅消息配置" :bordered="false" size="small">
    <NAlert type="info" :bordered="false" class="mb-4">
      <template #header>
        配置前请先在微信公众平台添加订阅消息模板
      </template>
      登录 <a href="https://mp.weixin.qq.com" target="_blank" rel="noopener">mp.weixin.qq.com</a> →
      功能 → 订阅消息 → 选用公共模板 → 复制模板 ID 填入下方。
    </NAlert>

    <NForm label-placement="left" label-width="160" class="max-w-2xl">
      <!-- 订单状态通知 -->
      <NFormItem label="订单状态通知">
        <NSwitch v-model:value="form.orderEnabled" />
        <span class="ml-2 text-gray-400 text-xs">状态变更时通知用户</span>
      </NFormItem>
      <NFormItem label="订单通知模板ID">
        <NInput v-model:value="form.orderTpl" placeholder="从微信公众平台复制的模板 ID" clearable />
      </NFormItem>

      <!-- 优惠券到账通知 -->
      <NFormItem label="优惠券到账通知">
        <NSwitch v-model:value="form.couponEnabled" />
        <span class="ml-2 text-gray-400 text-xs">发放优惠券时通知用户（生日券等）</span>
      </NFormItem>
      <NFormItem label="优惠券通知模板ID">
        <NInput v-model:value="form.couponTpl" placeholder="从微信公众平台复制的模板 ID" clearable />
      </NFormItem>

      <NFormItem>
        <NButton type="primary" :loading="saving" @click="handleSave">保存配置</NButton>
      </NFormItem>
    </NForm>
  </NCard>
</template>

<style scoped>
.max-w-2xl { max-width: 600px; }
.mb-4 { margin-bottom: 16px; }
.ml-2 { margin-left: 8px; }
.text-gray-400 { color: #999; }
.text-xs { font-size: 12px; }
</style>
