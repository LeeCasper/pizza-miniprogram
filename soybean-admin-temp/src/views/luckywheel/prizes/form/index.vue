<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { NButton, NSpace, NCard, NForm, NFormItem, NInput, NInputNumber, NSelect, NColorPicker, NSpin, NSwitch } from 'naive-ui';
import { fetchLuckyPrize, fetchCreateLuckyPrize, fetchUpdateLuckyPrize, fetchCouponTemplates } from '@/service/api';
import type { LuckyPrize, CouponTemplate } from '@/service/api';
import ImageUpload from '@/components/common/ImageUpload.vue';

defineOptions({ name: 'LuckyWheelPrizesForm' });

const router = useRouter();
const route = useRoute();
const isEdit = ref(false);
const saving = ref(false);
const loading = ref(false);

const form = ref<Partial<LuckyPrize>>({
  type: 'thanks',
  name: '',
  weight: 1,
  stock: null,
  couponTemplateId: null,
  pointsAmount: null,
  balanceAmount: null,
  color: '#F5C518',
  icon: '',
  sortOrder: 0,
  isActive: true,
});

const typeOptions = [
  { label: '优惠券', value: 'coupon' },
  { label: '积分', value: 'points' },
  { label: '余额', value: 'balance' },
  { label: '谢谢参与', value: 'thanks' },
  { label: '再来一次', value: 'again' },
];

const couponOptions = ref<{ label: string; value: number }[]>([]);

async function loadCouponTemplates() {
  const { data, error } = await fetchCouponTemplates();
  if (!error && data) {
    couponOptions.value = data.map((t: CouponTemplate) => ({ label: `${t.name} (#${t.id})`, value: t.id! }));
  }
}

onMounted(async () => {
  loadCouponTemplates();
  const id = route.params.id as string;
  if (id && id !== 'create') {
    isEdit.value = true;
    loading.value = true;
    const { data, error } = await fetchLuckyPrize(Number(id));
    if (!error && data) {
      form.value = {
        type: data.type,
        name: data.name,
        weight: data.weight,
        stock: data.stock,
        couponTemplateId: data.couponTemplateId,
        pointsAmount: data.pointsAmount,
        balanceAmount: data.balanceAmount,
        color: data.color,
        icon: data.icon,
        sortOrder: data.sortOrder,
        isActive: data.isActive,
      };
    }
    loading.value = false;
  }
});

async function handleSave() {
  if (!form.value.name) { window.$message?.warning('请填写奖品名称'); return; }
  if (form.value.type === 'coupon' && !form.value.couponTemplateId) {
    window.$message?.warning('优惠券奖品必须选择券模板'); return;
  }
  saving.value = true;
  const id = route.params.id as string;
  const payload = { ...form.value };

  let error: any;
  if (isEdit.value) {
    const res = await fetchUpdateLuckyPrize(Number(id), payload);
    error = res.error;
  } else {
    const res = await fetchCreateLuckyPrize(payload);
    error = res.error;
  }

  saving.value = false;
  if (!error) {
    window.$message?.success(isEdit.value ? '奖品已更新' : '奖品已创建');
    router.push('/lucky-wheel/prizes');
  }
}
</script>

<template>
  <NCard :title="isEdit ? '编辑奖品' : '新建奖品'" :bordered="false" class="card-wrapper">
    <template #header-extra>
      <NSpace>
        <NButton @click="router.push('/lucky-wheel/prizes')">返回</NButton>
        <NButton type="primary" :loading="saving" @click="handleSave">{{ isEdit ? '保存修改' : '创建' }}</NButton>
      </NSpace>
    </template>

    <NSpin :show="loading">
      <NForm label-placement="left" label-width="100" style="max-width: 640px;">
        <NFormItem label="奖品类型" required>
          <NSelect v-model:value="form.type" :options="typeOptions" style="width: 200px" />
        </NFormItem>
        <NFormItem label="名称" required>
          <NInput v-model:value="form.name" placeholder="转盘上显示的奖品名" />
        </NFormItem>
        <NFormItem label="券模板" required v-if="form.type === 'coupon'">
          <NSelect v-model:value="form.couponTemplateId" :options="couponOptions" placeholder="中奖后据此发券" filterable style="width: 280px" />
        </NFormItem>
        <NFormItem label="积分数量" required v-if="form.type === 'points'">
          <NInputNumber v-model:value="form.pointsAmount" :min="0" style="width: 200px" />
        </NFormItem>
        <NFormItem label="余额金额" required v-if="form.type === 'balance'">
          <NInputNumber v-model:value="form.balanceAmount" :min="0" :step="0.01" style="width: 200px" />
        </NFormItem>
        <NFormItem label="权重">
          <NInputNumber v-model:value="form.weight" :min="0" style="width: 160px" />
          <span style="margin-left:8px;color:#999;">越大越易抽中（相对值）</span>
        </NFormItem>
        <NFormItem label="库存">
          <NInputNumber v-model:value="form.stock" :min="0" placeholder="空 = 不限" style="width: 200px" />
        </NFormItem>
        <NFormItem label="颜色">
          <NColorPicker v-model:value="form.color" />
        </NFormItem>
        <NFormItem label="图标">
          <ImageUpload v-model="form.icon" :width="120" :height="120" />
        </NFormItem>
        <NFormItem label="排序">
          <NInputNumber v-model:value="form.sortOrder" style="width: 160px" />
        </NFormItem>
        <NFormItem label="启用">
          <NSwitch v-model:value="form.isActive" />
        </NFormItem>
      </NForm>
    </NSpin>
  </NCard>
</template>

<style scoped></style>
