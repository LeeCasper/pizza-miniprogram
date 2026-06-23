<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { NButton, NSpace, NCard, NForm, NFormItem, NInput, NInputNumber, NSelect, NColorPicker, NSpin, NSwitch } from 'naive-ui';
import { fetchCouponTemplate, fetchCreateCouponTemplate, fetchUpdateCouponTemplate, fetchProducts, type CouponTemplate, type AdminProduct } from '@/service/api';
import ImageUpload from '@/components/common/ImageUpload.vue';

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
  claimable: false,
  totalStock: null,
  perUserLimit: 1,
  claimPeriod: 'none',
  minMemberLevel: 0,
  maxDiscount: null,
  image: '',
  redeemProductName: '',
  redeemProductPrice: null,
  redeemProductImage: '',
  productId: null,
});

const productOptions = ref<{ label: string; value: number; price: string; image: string }[]>([]);

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
  { label: '百分比折扣', value: 'percentage' },
];

const claimPeriodOptions = [
  { label: '不限周期(累计限领)', value: 'none' },
  { label: '每周', value: 'weekly' },
  { label: '每月', value: 'monthly' },
];

onMounted(async () => {
  loadProducts();
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
        claimable: data.claimable,
        totalStock: data.totalStock,
        perUserLimit: data.perUserLimit,
        claimPeriod: data.claimPeriod,
        minMemberLevel: data.minMemberLevel,
        maxDiscount: data.maxDiscount,
        image: data.image,
        redeemProductName: data.redeemProductName,
        redeemProductPrice: data.redeemProductPrice,
        redeemProductImage: data.redeemProductImage,
        productId: data.productId,
      };
    }
    loading.value = false;
  }
});

async function loadProducts() {
  const { data, error } = await fetchProducts();
  if (!error && data) {
    productOptions.value = data.map((p: AdminProduct) => ({
      label: `${p.name} (¥${Number(p.price).toFixed(2)})`,
      value: p.id,
      price: p.price,
      image: p.image,
    }));
  }
}

watch(() => form.value.productId, (newVal) => {
  if (newVal) {
    const product = productOptions.value.find(p => p.value === newVal);
    if (product) {
      form.value.redeemProductName = product.label.replace(/\s*\(¥[\d.]+\)\s*$/, '');
      form.value.redeemProductPrice = Number(product.price);
      form.value.redeemProductImage = product.image || '';
    }
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
    router.push('/coupons/templates/list');
  }
}
</script>

<template>
  <NCard :title="isEdit ? '编辑模板' : '新建模板'" :bordered="false" class="card-wrapper">
    <template #header-extra>
      <NSpace>
        <NButton @click="router.push('/coupons/templates/list')">返回</NButton>
        <NButton type="primary" :loading="saving" @click="handleSave">{{ isEdit ? '保存修改' : '创建' }}</NButton>
      </NSpace>
    </template>

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
          <NInput v-model:value="form.discountValue" placeholder="固定金额填元数(如5);百分比填整数(如10=立减10%)" />
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
        <NFormItem label="封面图">
          <ImageUpload v-model="form.image" :width="200" :height="120" />
        </NFormItem>
        <template v-if="form.category === 'redeem'">
          <NFormItem label="关联商品">
            <NSelect
              v-model:value="form.productId"
              :options="productOptions"
              placeholder="选择商品自动填充(或留空手动填写)"
              clearable
              filterable
              style="width: 360px"
            />
            <span style="margin-left:8px;color:#999;font-size:12px;">选商品后自动填充下方字段</span>
          </NFormItem>
          <NFormItem label="兑换商品图">
            <ImageUpload v-model="form.redeemProductImage" :width="160" :height="160" />
          </NFormItem>
          <NFormItem label="兑换商品名">
            <NInput v-model:value="form.redeemProductName" placeholder="如：12英寸至尊披萨" />
          </NFormItem>
          <NFormItem label="兑换商品价格">
            <NInputNumber v-model:value="form.redeemProductPrice" :min="0" :step="0.01" placeholder="商品价值" style="width: 200px" />
          </NFormItem>
        </template>
        <NFormItem label="使用提示">
          <NInput v-model:value="form.useTip" placeholder="使用须知" type="textarea" />
        </NFormItem>
        <NFormItem label="折扣封顶" v-if="form.discountType === 'percentage'">
          <NInputNumber v-model:value="form.maxDiscount" :min="0" :step="0.01" placeholder="百分比券封顶金额，空=不封顶" style="width: 200px" />
        </NFormItem>
        <NFormItem label="可被领取">
          <NSwitch v-model:value="form.claimable" />
        </NFormItem>
        <NFormItem label="发放总量">
          <NInputNumber v-model:value="form.totalStock" :min="0" placeholder="空 = 不限" style="width: 200px" />
        </NFormItem>
        <NFormItem label="每人限领">
          <NInputNumber v-model:value="form.perUserLimit" :min="1" style="width: 160px" />
        </NFormItem>
        <NFormItem label="领取周期">
          <NSelect v-model:value="form.claimPeriod" :options="claimPeriodOptions" style="width: 200px" />
        </NFormItem>
        <NFormItem label="最低会员等级">
          <NInputNumber v-model:value="form.minMemberLevel" :min="0" style="width: 160px" />
          <span style="margin-left:8px;color:#999;">0=不限；数字越大等级越高(对应会员等级序号)</span>
        </NFormItem>
      </NForm>
    </NSpin>
  </NCard>
</template>

<style scoped></style>
