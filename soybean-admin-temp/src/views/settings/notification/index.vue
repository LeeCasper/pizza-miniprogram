<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { NButton, NCard, NForm, NFormItem, NInput, NAlert, useMessage } from 'naive-ui';
import { fetchNotificationSettings, fetchUpdateNotificationSettings } from '@/service/api';

defineOptions({ name: 'SettingsNotification' });

const message = useMessage();
const saving = ref(false);
const form = ref({ orderTpl: '', couponTpl: '', orderFields: '', couponFields: '' });

onMounted(async () => {
  const { data, error } = await fetchNotificationSettings();
  if (!error && data) {
    form.value.orderTpl = data.orderTpl || '';
    form.value.couponTpl = data.couponTpl || '';
    form.value.orderFields = data.orderFields || '';
    form.value.couponFields = data.couponFields || '';
  }
});

async function handleSave() {
  saving.value = true;
  const { error } = await fetchUpdateNotificationSettings({
    orderTpl: form.value.orderTpl,
    couponTpl: form.value.couponTpl,
    orderFields: form.value.orderFields,
    couponFields: form.value.couponFields,
  });
  saving.value = false;
  if (!error) message.success('保存成功');
}
</script>

<template>
  <NCard title="订阅消息配置" :bordered="false" size="small">
    <NAlert type="warning" :bordered="false" class="mb-4">
      <template #header>配置步骤</template>
      1. 登录 <a href="https://mp.weixin.qq.com" target="_blank" rel="noopener">微信公众平台</a>
      → 功能 → 订阅消息 → 选用模板 → 复制模板 ID<br>
      2. 查看模板详情，记录每个字段的 <b>字段名</b> 和 <b>中文含义</b>（如 thing1=订单编号）<br>
      3. 在下方填入模板 ID 和字段映射
    </NAlert>

    <div class="flex-col gap-6 w-full">
      <!-- 订单通知 -->
      <NCard size="small" title="订单状态通知" :bordered="true">
        <NForm label-placement="top" class="max-w-xl">
          <NFormItem label="模板 ID">
            <NInput v-model:value="form.orderTpl" placeholder="从微信公众平台复制" clearable />
          </NFormItem>
          <NFormItem label="字段映射（每行一个：字段名=数据来源）">
            <NInput
              v-model:value="form.orderFields"
              type="textarea"
              placeholder="thing1=订单编号&#10;phrase2=订单状态&#10;thing3=门店名称&#10;character_string4=取餐码"
              :autosize="{ minRows: 4, maxRows: 8 }"
            />
            <div class="hint">
              可选数据来源：订单编号, 订单状态, 门店名称, 取餐码, 预约时间, 支付金额<br>
              字段名请严格按照微信公众平台模板详情中的名称填写
            </div>
          </NFormItem>
        </NForm>
      </NCard>

      <!-- 优惠券通知 -->
      <NCard size="small" title="优惠券到账通知" :bordered="true">
        <NForm label-placement="top" class="max-w-xl">
          <NFormItem label="模板 ID">
            <NInput v-model:value="form.couponTpl" placeholder="从微信公众平台复制" clearable />
          </NFormItem>
          <NFormItem label="字段映射（每行一个：字段名=数据来源）">
            <NInput
              v-model:value="form.couponFields"
              type="textarea"
              placeholder="thing1=券名称&#10;time2=有效期&#10;thing3=提示信息"
              :autosize="{ minRows: 3, maxRows: 6 }"
            />
            <div class="hint">
              可选数据来源：券名称, 有效期, 提示信息
            </div>
          </NFormItem>
        </NForm>
      </NCard>

      <NButton type="primary" :loading="saving" @click="handleSave" size="large">保存配置</NButton>
    </div>
  </NCard>
</template>

<style scoped>
.max-w-xl { max-width: 560px; }
.w-full { width: 100%; }
.mb-4 { margin-bottom: 16px; }
.flex-col { display: flex; flex-direction: column; }
.gap-6 { gap: 24px; }
.hint { margin-top: 8px; font-size: 12px; color: #999; line-height: 1.6; }
</style>
