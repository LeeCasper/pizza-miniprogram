<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { NButton, NSpace, NForm, NFormItem, NInput, NInputNumber, NSelect, NColorPicker, NSpin } from 'naive-ui';
import { fetchCouponTemplate, fetchCreateCouponTemplate, fetchUpdateCouponTemplate, type CouponTemplate } from '@/service/api';

defineOptions({ name: 'CouponTemplatesForm' });

const router = useRouter();
const route = useRoute();
const isEdit = ref(false);
const saving = ref(false);
const loading = ref(false);

const form = ref<Partial<CouponTemplate>>({
  name: '',
  desc: '',
  category: 'discount',
  value: '',
  discountType: 'fixed_amount',
  discountValue: '',
  minSpend: 0,
  validDays: 30,
  color: '#D32F2F',
  useTip: '',
});

const categoryOptions = [
  { label: '满减券', value: 'discount' },
  { label: '兑换券', value: 'redeem' },
];

const discountTypeOptions = [
  { label: '固定金额', value: 'fixed_amount' },
  { label: '免费兑换', value: 'free_redeem' },
  { label: '买一赠一', value: 'buy_one_get_one' },
  { label: '免配送费', value: 'free_delivery' },
  { label: '半价', value: 'half_price' },
];

onMounted(async () => {
  const id = route.params.id as string;
  if (id && id !== 'create') {
    isEdit.value = true;
    loading.value = true;
    const { data, error } = await fetchCouponTemplate(Number(id));
    if (!error && data) {
      form.value = {
        name: data.name,
        desc: data.desc,
        category: data.category,
        value: data.value,
        discountType: data.discountType,
        discountValue: data.discountValue,
        minSpend: data.minSpend,
        validDays: data.validDays,
        color: data.color,
        useTip: data.useTip,
      };
    }
    loading.value = false;
  }
});

async function handleSave() {
  saving.value = true;
  const id = route.params.id as string;
  const payload = { ...form.value };

  let error: any;
  if (isEdit.value) {
    const res = await fetchUpdateCouponTemplate(Number(id), payload);
    error = res.error;
  } else {
    const res = await fetchCreateCouponTemplate(payload);
    error = res.error;
  }

  saving.value = false;
  if (!error) {
    window.$message?.success(isEdit.value ? '模板已更新' : '模板已创建');
    router.push('/coupon-templates/list');
  }
}
</script>

<template>
  <div class="ct-form">
    <div class="page-header">
      <h2 class="page-title">{{ isEdit ? '编辑模板' : '新建模板' }}</h2>
    </div>

    <NSpin :show="loading">
      <NForm label-placement="left" label-width="100" style="max-width: 640px;">
        <NFormItem label="名称" required>
          <NInput v-model:value="form.name" placeholder="优惠券名称" />
        </NFormItem>
        <NFormItem label="描述">
          <NInput v-model:value="form.desc" placeholder="简短描述" />
        </NFormItem>
        <NFormItem label="类别" required>
          <NSelect v-model:value="form.category" :options="categoryOptions" style="width: 200px" />
        </NFormItem>
        <NFormItem label="面值标签">
          <NInput v-model:value="form.value" placeholder="如：¥5、买一赠一" />
        </NFormItem>
        <NFormItem label="优惠类型" required>
          <NSelect v-model:value="form.discountType" :options="discountTypeOptions" style="width: 200px" />
        </NFormItem>
        <NFormItem label="优惠值">
          <NInput v-model:value="form.discountValue" placeholder="如：5 (抵扣5元) 或 50 (打5折)" />
        </NFormItem>
        <NFormItem label="最低消费">
          <NInputNumber v-model:value="form.minSpend" :min="0" :step="0.01" style="width: 160px" />
        </NFormItem>
        <NFormItem label="有效天数">
          <NInputNumber v-model:value="form.validDays" :min="1" style="width: 120px" />
        </NFormItem>
        <NFormItem label="颜色">
          <NColorPicker v-model:value="form.color" />
        </NFormItem>
        <NFormItem label="使用提示">
          <NInput v-model:value="form.useTip" placeholder="使用须知" type="textarea" />
        </NFormItem>

        <NFormItem>
          <NSpace>
            <NButton type="primary" :loading="saving" @click="handleSave">{{ isEdit ? '保存修改' : '创建' }}</NButton>
            <NButton @click="router.push('/coupon-templates/list')">取消</NButton>
          </NSpace>
        </NFormItem>
      </NForm>
    </NSpin>
  </div>
</template>

<style scoped>
.ct-form { padding: 4px; }
.page-header { margin-bottom: 24px; }
.page-title { margin: 0; font-size: 22px; font-weight: 700; }
</style>
