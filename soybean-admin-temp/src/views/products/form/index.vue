<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { NForm, NFormItem, NInput, NInputNumber, NSelect, NSpace, NButton, NCard, NTag, NImage, NCollapse, NCollapseItem } from 'naive-ui';
import { fetchProduct, fetchCreateProduct, fetchUpdateProduct } from '@/service/api';
import ImageUpload from '@/components/common/ImageUpload.vue';
import TagArrayInput from '@/components/common/TagArrayInput.vue';

defineOptions({ name: 'ProductForm' });

const router = useRouter();
const route = useRoute();
const isEdit = computed(() => !!route.params.id);
const loading = ref(false);

const categoryOptions = [
  { label: '披萨', value: 'pizza' },
  { label: '榴莲披萨', value: 'durian' },
  { label: '凤梨酥', value: 'pineapple' },
];

const tagOptions = [
  { label: '经典', value: '经典' },
  { label: '爆款', value: '爆款' },
  { label: '人气', value: '人气' },
  { label: '招牌', value: '招牌' },
  { label: '新品', value: '新品' },
  { label: '限定', value: '限定' },
];

const form = ref({
  name: '',
  category_key: 'pizza' as string | null,
  price: 68,
  image: '',
  tag: '' as string | null,
  desc: '',
  detail_desc: '',
  size_desc: '',
  ingredients: [] as string[],
  is_available: 1,
});

onMounted(async () => {
  if (isEdit.value) {
    loading.value = true;
    const { data, error } = await fetchProduct(Number(route.params.id));
    if (!error && data) {
      form.value = {
        name: data.name || '',
        category_key: data.category_key || null,
        price: parseFloat(data.price) || 0,
        image: data.image || '',
        tag: data.tag || null,
        desc: data.desc || '',
        detail_desc: data.detail_desc || '',
        size_desc: data.size_desc || '',
        ingredients: data.ingredients || [],
        is_available: data.is_available,
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
  if (isEdit.value) {
    const { error } = await fetchUpdateProduct(Number(route.params.id), payload);
    if (!error) {
      window.$message?.success('商品已更新');
      router.push('/products');
    }
  } else {
    const { error } = await fetchCreateProduct(payload);
    if (!error) {
      window.$message?.success('商品已创建');
      router.push('/products');
    }
  }
  loading.value = false;
}
</script>

<template>
  <div class="product-form">
    <div class="page-header">
      <h2 class="page-title">{{ isEdit ? '编辑商品' : '新建商品' }}</h2>
    </div>
    <NCard>
      <NForm :model="form" label-placement="top" :style="{ maxWidth: '680px' }">
        <NFormItem label="商品名称" required>
          <NInput v-model:value="form.name" placeholder="例：经典玛格丽特披萨" />
        </NFormItem>
        <NFormItem label="分类">
          <NSelect v-model:value="form.category_key" :options="categoryOptions" style="width:180px" />
        </NFormItem>
        <NFormItem label="价格 (元)" required>
          <NInputNumber v-model:value="form.price" :min="0" :step="0.01" style="width:100%" />
        </NFormItem>
        <NFormItem label="商品图片">
          <ImageUpload v-model="form.image" :width="160" :height="160" />
          <NCollapse style="margin-top:8px;width:100%">
            <NCollapseItem title="或手动输入图片 URL" name="url">
              <NInput v-model:value="form.image" placeholder="https://..." />
            </NCollapseItem>
          </NCollapse>
        </NFormItem>
        <NFormItem label="标签">
          <NSelect v-model:value="form.tag" :options="tagOptions" style="width:150px" clearable />
        </NFormItem>
        <NFormItem label="简介">
          <NInput v-model:value="form.desc" type="textarea" placeholder="简短描述" />
        </NFormItem>
        <NFormItem label="详情描述">
          <NInput v-model:value="form.detail_desc" type="textarea" placeholder="详细描述" :autosize="{ minRows: 2 }" />
        </NFormItem>
        <NFormItem label="规格说明">
          <NInput v-model:value="form.size_desc" placeholder="例：9寸 / 12寸" />
        </NFormItem>
        <NFormItem label="配料">
          <TagArrayInput v-model="form.ingredients" placeholder="输入配料" />
        </NFormItem>
        <NFormItem>
          <NSpace>
            <NButton type="primary" :loading="loading" @click="handleSubmit">
              {{ isEdit ? '保存修改' : '创建商品' }}
            </NButton>
            <NButton @click="router.push('/products')">取消</NButton>
          </NSpace>
        </NFormItem>
      </NForm>
    </NCard>
  </div>
</template>

<style scoped>
.product-form { padding: 4px; }
.page-header { margin-bottom: 16px; }
</style>
