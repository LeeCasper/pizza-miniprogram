<script setup lang="ts">
import { ref, onMounted } from 'vue';
import {
  NButton,
  NCard,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  useMessage,
} from 'naive-ui';
import { fetchBusinessSettings, fetchUpdateBusinessSettings } from '@/service/api';

defineOptions({ name: 'SettingsBusiness' });

const message = useMessage();
const loading = ref(false);
const saving = ref(false);

const form = ref({
  orderCancelMinutes: 1,
  unpaidTimeoutMinutes: 30,
  storeName: '',
});

onMounted(async () => {
  loading.value = true;
  const { data, error } = await fetchBusinessSettings();
  if (!error && data) {
    form.value.orderCancelMinutes = data.orderCancelMinutes ?? 1;
    form.value.unpaidTimeoutMinutes = data.unpaidTimeoutMinutes ?? 30;
    form.value.storeName = data.storeName || '';
  }
  loading.value = false;
});

async function handleSave() {
  saving.value = true;

  const payload = {
    orderCancelMinutes: form.value.orderCancelMinutes,
    unpaidTimeoutMinutes: form.value.unpaidTimeoutMinutes,
    storeName: form.value.storeName,
  };

  const { error } = await fetchUpdateBusinessSettings(payload);
  if (!error) {
    message.success('业务配置已保存');
  } else {
    message.error('保存失败');
  }
  saving.value = false;
}
</script>

<template>
  <NCard title="业务配置" :bordered="false" size="small">
    <template #header-extra>
      <NButton type="primary" size="small" :loading="saving" @click="handleSave">
        保存
      </NButton>
    </template>

    <NForm label-width="160" label-placement="left">
      <NFormItem label="取消时限（分钟）">
        <NInputNumber
          v-model:value="form.orderCancelMinutes"
          :min="0"
          :max="1440"
          :step="1"
          placeholder="请输入取消时限"
          style="width: 100%"
        />
      </NFormItem>

      <NFormItem label="未支付超时（分钟）">
        <NInputNumber
          v-model:value="form.unpaidTimeoutMinutes"
          :min="1"
          :max="1440"
          :step="1"
          placeholder="请输入未支付超时时间"
          style="width: 100%"
        />
      </NFormItem>

      <NFormItem label="门店名称">
        <NInput v-model:value="form.storeName" placeholder="订单中显示的门店名" />
      </NFormItem>

      <NFormItem label="">
        <div style="color: #999; font-size: 12px; line-height: 1.8">
          <span>· 取消时限：用户下单后可取消的时间窗口。设为 0 表示不允许用户取消。管理员取消不受此限制。</span>
          <br />
          <span>· 未支付超时：超过此时间的未支付订单将自动取消并释放库存和优惠券。</span>
          <br />
          <span>· 门店名称：用于订单小票、通知等场景中显示的门店名称。</span>
        </div>
      </NFormItem>
    </NForm>
  </NCard>
</template>
