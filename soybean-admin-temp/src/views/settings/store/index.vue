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
import { fetchStoreSettings, fetchUpdateStoreSettings } from '@/service/api';

defineOptions({ name: 'SettingsStore' });

const message = useMessage();
const loading = ref(false);
const saving = ref(false);

const form = ref({
  name: '',
  address: '',
  phone: '',
  business_hours: '',
  latitude: null as number | null,
  longitude: null as number | null,
});

onMounted(async () => {
  loading.value = true;
  const { data, error } = await fetchStoreSettings();
  if (!error && data) {
    form.value.name = data.name || '';
    form.value.address = data.address || '';
    form.value.phone = data.phone || '';
    form.value.business_hours = data.business_hours || '';
    form.value.latitude = data.latitude;
    form.value.longitude = data.longitude;
  }
  loading.value = false;
});

async function handleSave() {
  saving.value = true;

  const payload: Record<string, any> = {
    name: form.value.name,
    address: form.value.address,
    phone: form.value.phone,
    business_hours: form.value.business_hours,
    latitude: form.value.latitude,
    longitude: form.value.longitude,
  };

  const { error } = await fetchUpdateStoreSettings(payload);
  if (!error) {
    message.success('门店设置已保存');
  } else {
    message.error('保存失败');
  }
  saving.value = false;
}
</script>

<template>
  <NCard title="门店设置" :bordered="false" size="small" class="card-wrapper">
    <template #header-extra>
      <NButton type="primary" size="small" :loading="saving" @click="handleSave">
        保存
      </NButton>
    </template>

    <NForm label-width="120" label-placement="left">
      <NFormItem label="门店名称">
        <NInput v-model:value="form.name" placeholder="请输入门店名称" />
      </NFormItem>

      <NFormItem label="门店地址">
        <NInput v-model:value="form.address" placeholder="请输入门店地址" />
      </NFormItem>

      <NFormItem label="联系电话">
        <NInput v-model:value="form.phone" placeholder="请输入联系电话" />
      </NFormItem>

      <NFormItem label="营业时间">
        <NInput v-model:value="form.business_hours" placeholder="例如 10:00-22:00" />
      </NFormItem>

      <NFormItem label="纬度 (Latitude)">
        <NInputNumber
          v-model:value="form.latitude"
          :precision="7"
          :min="-90"
          :max="90"
          :step="0.0001"
          placeholder="例如 32.9618570"
          style="width: 100%"
        />
      </NFormItem>

      <NFormItem label="经度 (Longitude)">
        <NInputNumber
          v-model:value="form.longitude"
          :precision="7"
          :min="-180"
          :max="180"
          :step="0.0001"
          placeholder="例如 114.6468790"
          style="width: 100%"
        />
      </NFormItem>

      <NFormItem label="">
        <span style="color: #999; font-size: 12px">
          💡 坐标获取方式：打开
          <a href="https://lbs.qq.com/getPoint/" target="_blank" style="color: #18a058">腾讯地图拾取坐标</a>
          ，搜索地址后点击地图获取经纬度
        </span>
      </NFormItem>
    </NForm>
  </NCard>
</template>
