<script setup lang="ts">
import { ref, onMounted } from 'vue';
import {
  NButton,
  NCard,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NSwitch,
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
  shopEnabled: true,
  shopNotice: '',
  icpBeian: '',
  gonganBeian: '',
});

onMounted(async () => {
  loading.value = true;
  const { data, error } = await fetchBusinessSettings();
  if (!error && data) {
    form.value.orderCancelMinutes = data.orderCancelMinutes ?? 1;
    form.value.unpaidTimeoutMinutes = data.unpaidTimeoutMinutes ?? 30;
    form.value.storeName = data.storeName || '';
    form.value.shopEnabled = data.shopEnabled !== false;
    form.value.shopNotice = data.shopNotice || '';
    form.value.icpBeian = data.icpBeian || '';
    form.value.gonganBeian = data.gonganBeian || '';
  }
  loading.value = false;
});

async function handleSave() {
  saving.value = true;

  const payload = {
    orderCancelMinutes: form.value.orderCancelMinutes,
    unpaidTimeoutMinutes: form.value.unpaidTimeoutMinutes,
    storeName: form.value.storeName,
    shopEnabled: form.value.shopEnabled,
    shopNotice: form.value.shopNotice,
    icpBeian: form.value.icpBeian,
    gonganBeian: form.value.gonganBeian,
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
  <NCard title="业务配置" :bordered="false" size="small" class="card-wrapper">
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

      <NFormItem label="会员商城开关">
        <NSwitch :value="form.shopEnabled" @update:value="(v: boolean) => (form.shopEnabled = v)" />
        <span style="margin-left: 12px; color: #999; font-size: 13px;">
          {{ form.shopEnabled ? '已开启 — 用户可正常访问会员商城' : '已关闭 — 用户将看到停用提示' }}
        </span>
      </NFormItem>

      <NFormItem label="商城停用提示语">
        <NInput
          v-model:value="form.shopNotice"
          placeholder="会员商城暂时关闭，敬请期待…"
        />
        <div style="color: #999; font-size: 12px; margin-top: 4px;">
          关闭商城开关后，小程序端将展示此提示语。留空则显示默认提示。
        </div>
      </NFormItem>

      <NFormItem label="ICP 备案号">
        <NInput v-model:value="form.icpBeian" placeholder="例如：沪ICP备2024XXXXXX号-1" />
      </NFormItem>

      <NFormItem label="公安备案号">
        <NInput v-model:value="form.gonganBeian" placeholder="例如：沪公网安备 310XXXXXXXXXXX号" />
      </NFormItem>

      <NFormItem label="">
        <div style="color: #999; font-size: 12px; line-height: 1.8">
          <span>· 取消时限：用户下单后可取消的时间窗口。设为 0 表示不允许用户取消。管理员取消不受此限制。</span>
          <br />
          <span>· 未支付超时：超过此时间的未支付订单将自动取消并释放库存和优惠券。</span>
          <br />
          <span>· 门店名称：用于订单小票、通知等场景中显示的门店名称。</span>
          <br />
          <span>· 会员商城开关：关闭后小程序端商城 tab 和商城页面将显示停用提示，用户无法浏览和购买商品。</span>
          <br />
          <span>· 商城停用提示语：自定义关闭时的提示文字，支持修改。</span>
          <br />
          <span>· ICP 备案号和公安备案号：填写后将在管理后台登录页底部展示。留空则不展示对应行。</span>
        </div>
      </NFormItem>
    </NForm>
  </NCard>
</template>
