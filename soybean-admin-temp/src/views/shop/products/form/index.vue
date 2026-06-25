<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { NButton, NCard, NCollapse, NCollapseItem, NForm, NFormItem, NInput, NInputNumber, NSelect, NSpace, NSwitch } from 'naive-ui';
import { fetchCreateShopProduct, fetchShopCategories, fetchShopProduct, fetchUpdateShopProduct } from '@/service/api';
import ImageUpload from '@/components/common/ImageUpload.vue';
import MultiImageUpload from '@/components/common/MultiImageUpload.vue';

defineOptions({ name: 'ShopProductsForm' });

const router = useRouter();
const route = useRoute();
const isEdit = computed(() => !!route.params.id);
const loading = ref(false);

const categoryOptions = ref<{ label: string; value: string }[]>([]);

const form = ref({
  name: '',
  shop_category_key: null as string | null,
  subtitle: '',
  price: 0,
  original_price: null as number | null,
  main_image: '',
  images: [] as string[],
  detail_desc: '',
  stock: 0,
  tag: '',
  is_available: 1,
  sort_order: 0,
});

onMounted(async () => {
  const catRes = await fetchShopCategories();
  if (!catRes.error && catRes.data) {
    categoryOptions.value = catRes.data.map(c => ({ label: c.name, value: c.key }));
  }
  if (isEdit.value) {
    loading.value = true;
    const { data, error } = await fetchShopProduct(Number(route.params.id));
    if (!error && data) {
      form.value = {
        name: data.name || '',
        shop_category_key: data.shop_category_key || null,
        subtitle: data.subtitle || '',
        price: parseFloat(data.price) || 0,
        original_price: data.original_price != null ? parseFloat(data.original_price) : null,
        main_image: data.main_image || '',
        images: Array.isArray(data.images) ? data.images : [],
        detail_desc: data.detail_desc || '',
        stock: data.stock ?? 0,
        tag: data.tag || '',
        is_available: data.is_available,
        sort_order: data.sort_order ?? 0,
      };
    }
    loading.value = false;
  }
});

async function handleSubmit() {
  if (!form.value.name) {
    window.$message?.warning('请填写商品名称');
    return;
  }
  loading.value = true;
  const payload = { ...form.value };
  if (!payload.main_image && payload.images.length) {
    payload.main_image = payload.images[0];
  }
  if (isEdit.value) {
    const { error } = await fetchUpdateShopProduct(Number(route.params.id), payload);
    if (!error) {
      window.$message?.success('商品已更新');
      router.push('/shop/products');
    }
  } else {
    const { error } = await fetchCreateShopProduct(payload);
    if (!error) {
      window.$message?.success('商品已创建');
      router.push('/shop/products');
    }
  }
  loading.value = false;
}
</script>

<template>
  <NCard :title="isEdit ? '编辑商城商品' : '新建商城商品'" :bordered="false" class="card-wrapper">
    <template #header-extra>
      <NSpace>
        <NButton @click="router.push('/shop/products')">返回</NButton>
        <NButton type="primary" :loading="loading" @click="handleSubmit">
          {{ isEdit ? '保存修改' : '创建商品' }}
        </NButton>
      </NSpace>
    </template>
    <NForm :model="form" label-placement="top" :style="{ maxWidth: '680px' }">
      <NFormItem label="商品名称" required>
        <NInput v-model:value="form.name" placeholder="例：联名帆布袋" />
      </NFormItem>
      <NFormItem label="副标题">
        <NInput v-model:value="form.subtitle" placeholder="一句话卖点" />
      </NFormItem>
      <NFormItem label="分类">
        <NSelect v-model:value="form.shop_category_key" :options="categoryOptions" clearable style="width:200px" />
      </NFormItem>
      <NFormItem label="售价 (元)" required>
        <NInputNumber v-model:value="form.price" :min="0" :step="0.01" style="width:100%" />
      </NFormItem>
      <NFormItem label="原价 (元，划线价，可空)">
        <NInputNumber v-model:value="form.original_price" :min="0" :step="0.01" clearable style="width:100%" />
      </NFormItem>
      <NFormItem label="主图">
        <ImageUpload v-model="form.main_image" :width="160" :height="160" />
        <NCollapse style="margin-top:8px;width:100%">
          <NCollapseItem title="或手动输入主图 URL" name="url">
            <NInput v-model:value="form.main_image" placeholder="https://..." />
          </NCollapseItem>
        </NCollapse>
      </NFormItem>
      <NFormItem label="详情轮播图">
        <MultiImageUpload v-model="form.images" :width="120" :height="120" :max="6" />
      </NFormItem>
      <NFormItem label="角标文案">
        <NInput v-model:value="form.tag" placeholder="例：新品 / 热卖" style="width:200px" />
      </NFormItem>
      <NFormItem label="库存">
        <NInputNumber v-model:value="form.stock" :min="0" style="width:100%" />
      </NFormItem>
      <NFormItem label="详情描述">
        <NInput v-model:value="form.detail_desc" type="textarea" placeholder="商品详细描述" :autosize="{ minRows: 3 }" />
      </NFormItem>
      <NFormItem label="排序">
        <NInputNumber v-model:value="form.sort_order" :min="0" style="width:100%" />
      </NFormItem>
      <NFormItem label="上架">
        <NSwitch :value="!!form.is_available" @update:value="(v: boolean) => (form.is_available = v ? 1 : 0)" />
      </NFormItem>
    </NForm>
  </NCard>
</template>

<style scoped></style>
