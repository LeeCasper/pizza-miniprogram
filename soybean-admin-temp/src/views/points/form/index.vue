<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { NForm, NFormItem, NInput, NInputNumber, NSelect, NSpace, NButton, NCard, NDivider, NTag, NImage, NCollapse, NCollapseItem } from 'naive-ui';
import { fetchPointsProduct, fetchCreatePointsProduct, fetchUpdatePointsProduct, type PointsProduct } from '@/service/api';
import ImageUpload from '@/components/common/ImageUpload.vue';
import TagArrayInput from '@/components/common/TagArrayInput.vue';

defineOptions({ name: 'PointsForm' });

const router = useRouter();
const route = useRoute();
const isEdit = computed(() => !!route.params.id);
const loading = ref(false);

const form = ref<PointsProduct>({
  name: '',
  desc: '',
  detailDesc: '',
  points: 100,
  image: '',
  stock: -1,
  tag: '',
  highlights: [],
  redeemType: 'coupon',
  couponName: '',
  couponCategory: 'redeem',
  couponValue: '',
  couponDiscountType: 'free_redeem',
  couponDiscountValue: '',
  couponMinSpend: 0,
  couponValidDays: 30,
  useTip: '',
  isActive: 1,
});

const redeemTypeOptions = [
  { label: '优惠券', value: 'coupon' },
  { label: '实物商品', value: 'physical' },
];

const discountTypeOptions = [
  { label: '免费兑换', value: 'free_redeem' },
  { label: '买一赠一', value: 'buy_one_get_one' },
  { label: '半价', value: 'half_price' },
  { label: '固定金额', value: 'fixed_amount' },
];

const activeOptions = [
  { label: '启用', value: 1 },
  { label: '禁用', value: 0 },
];

onMounted(async () => {
  if (isEdit.value) {
    loading.value = true;
    const { data, error } = await fetchPointsProduct(Number(route.params.id));
    if (!error && data) {
      const p = data;
      form.value = {
        name: p.name || '',
        desc: p.desc || '',
        detailDesc: p.detailDesc || '',
        points: p.points,
        image: p.image || '',
        stock: p.stock,
        tag: p.tag || '',
        highlights: p.highlights || [],
        redeemType: p.redeemType || 'coupon',
        couponName: p.couponName || '',
        couponCategory: p.couponCategory || 'redeem',
        couponValue: p.couponValue || '',
        couponDiscountType: p.couponDiscountType || 'free_redeem',
        couponDiscountValue: p.couponDiscountValue || '',
        couponMinSpend: p.couponMinSpend || 0,
        couponValidDays: p.couponValidDays || 30,
        useTip: p.useTip || '',
        isActive: p.isActive ? 1 : 0,
      };
    }
    loading.value = false;
  }
});

async function handleSubmit() {
  if (!form.value.name || !form.value.points) {
    window.$message?.warning('请填写商品名称和积分');
    return;
  }
  loading.value = true;
  if (isEdit.value) {
    const { error } = await fetchUpdatePointsProduct(Number(route.params.id), form.value);
    if (!error) {
      window.$message?.success('积分商品已更新');
      router.push('/points');
    }
  } else {
    const { error } = await fetchCreatePointsProduct(form.value);
    if (!error) {
      window.$message?.success('积分商品已创建');
      router.push('/points');
    }
  }
  loading.value = false;
}
</script>

<template>
  <NCard :title="isEdit ? '编辑积分商品' : '新建积分商品'" :bordered="false" class="card-wrapper">
    <template #header-extra>
      <NSpace>
        <NButton @click="router.push('/points')">返回</NButton>
        <NButton type="primary" :loading="loading" @click="handleSubmit">
          {{ isEdit ? '保存修改' : '创建商品' }}
        </NButton>
      </NSpace>
    </template>
    <NForm :model="form" label-placement="top" :style="{ maxWidth: '640px' }">
      <NFormItem label="商品名称" required>
        <NInput v-model:value="form.name" placeholder="例：买一赠一券" />
      </NFormItem>

      <NFormItem label="兑换类型">
        <NSelect v-model:value="form.redeemType" :options="redeemTypeOptions" style="width:150px" />
      </NFormItem>

      <NFormItem label="所需积分" required>
        <NInputNumber v-model:value="form.points" :min="1" style="width:100%" />
      </NFormItem>

      <NFormItem label="库存 (-1 表示不限)">
        <NInputNumber v-model:value="form.stock" :min="-1" style="width:100%" />
      </NFormItem>

      <NFormItem label="标签">
        <NInput v-model:value="form.tag" placeholder="例：热门" />
      </NFormItem>

      <NFormItem label="商品图片">
        <ImageUpload v-model="form.image" :width="160" :height="160" />
      </NFormItem>

      <NFormItem label="简介">
        <NInput v-model:value="form.desc" type="textarea" placeholder="简短描述" />
      </NFormItem>

      <NFormItem label="详情">
        <NInput v-model:value="form.detailDesc" type="textarea" placeholder="详细描述" :autosize="{ minRows: 3 }" />
      </NFormItem>

      <NFormItem label="亮点">
        <TagArrayInput v-model="form.highlights" placeholder="输入亮点" />
      </NFormItem>

      <!-- Coupon template -->
      <template v-if="form.redeemType === 'coupon'">
        <NDivider>生成优惠券模板</NDivider>

        <NFormItem label="券名称">
          <NInput v-model:value="form.couponName" placeholder="例：买一赠一券" />
        </NFormItem>

        <NFormItem label="面值/描述">
          <NInput v-model:value="form.couponValue" placeholder="例：买一赠一" />
        </NFormItem>

        <NFormItem label="折扣类型">
          <NSelect v-model:value="form.couponDiscountType" :options="discountTypeOptions" style="width:160px" />
        </NFormItem>

        <NFormItem label="折扣值">
          <NInput v-model:value="form.couponDiscountValue" placeholder="例：50% 或 5元" />
        </NFormItem>

        <NFormItem label="最低消费">
          <NInputNumber v-model:value="form.couponMinSpend" :min="0" :step="0.01" style="width:100%" />
        </NFormItem>

        <NFormItem label="有效天数">
          <NInputNumber v-model:value="form.couponValidDays" :min="1" style="width:100%" />
        </NFormItem>

        <NFormItem label="使用提示">
          <NInput v-model:value="form.useTip" placeholder="例：仅限堂食" />
        </NFormItem>
      </template>

      <NFormItem v-if="isEdit" label="状态">
        <NSelect v-model:value="form.isActive" :options="activeOptions" style="width:120px" />
      </NFormItem>
    </NForm>
  </NCard>
</template>

<style scoped></style>
