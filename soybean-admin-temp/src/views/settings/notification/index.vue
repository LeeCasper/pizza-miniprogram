<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { NButton, NCard, NForm, NFormItem, NInput, NAlert, useMessage } from 'naive-ui';
import { fetchNotificationSettings, fetchUpdateNotificationSettings } from '@/service/api';

defineOptions({ name: 'SettingsNotification' });

const message = useMessage();
const saving = ref(false);

const form = ref({ orderTpl: '', couponTpl: '' });

onMounted(async () => {
  const { data, error } = await fetchNotificationSettings();
  if (!error && data) {
    form.value.orderTpl = data.orderTpl || '';
    form.value.couponTpl = data.couponTpl || '';
  }
});

async function handleSave() {
  saving.value = true;
  const { error } = await fetchUpdateNotificationSettings({
    orderTpl: form.value.orderTpl,
    couponTpl: form.value.couponTpl,
  });
  saving.value = false;
  if (!error) message.success('保存成功');
}
</script>

<template>
  <NCard title="订阅消息配置" :bordered="false" size="small">
    <NAlert type="info" :bordered="false" class="mb-4">
      <template #header>配置前请先在微信公众平台添加订阅消息模板</template>
      登录 <a href="https://mp.weixin.qq.com" target="_blank" rel="noopener">mp.weixin.qq.com</a> →
      功能 → 订阅消息 → 选用公共模板 → 复制模板 ID 填入下方。
      <br>填入模板 ID 后即自动开启，留空则关闭。
    </NAlert>

    <NForm label-placement="left" label-width="160" class="max-w-xl">
      <NFormItem label="订单状态通知模板ID">
        <NInput v-model:value="form.orderTpl" placeholder="例如: AbCdEf123..." clearable />
      </NFormItem>
      <NFormItem label="优惠券通知模板ID">
        <NInput v-model:value="form.couponTpl" placeholder="例如: AbCdEf123..." clearable />
      </NFormItem>
      <NFormItem>
        <NButton type="primary" :loading="saving" @click="handleSave">保存配置</NButton>
      </NFormItem>
    </NForm>
  </NCard>
</template>

<style scoped>
.max-w-xl { max-width: 540px; }
.mb-4 { margin-bottom: 16px; }
</style>
