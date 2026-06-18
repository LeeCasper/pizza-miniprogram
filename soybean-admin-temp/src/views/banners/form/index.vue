<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { NButton, NSpace, NForm, NFormItem, NInput, NInputNumber, NSelect } from 'naive-ui';
import ImageUpload from '@/components/common/ImageUpload.vue';
import { fetchBanner, fetchCreateBanner, fetchUpdateBanner, fetchProducts, type Banner } from '@/service/api';

defineOptions({ name: 'BannersForm' });

const router = useRouter();
const route = useRoute();
const isEdit = ref(false);
const saving = ref(false);
const loading = ref(false);

const form = ref<Partial<Banner>>({
  imageUrl: '',
  title: '',
  subtitle: '',
  tag: '',
  linkType: 'none',
  linkProductId: null,
  sortOrder: 0,
});

const productOptions = ref<{ label: string; value: number }[]>([]);

const linkTypeOptions = [
  { label: '无链接', value: 'none' },
  { label: '商品链接', value: 'product' },
];

async function loadProductOptions() {
  const { data, error } = await fetchProducts();
  if (!error && data) {
    productOptions.value = data.map((p: any) => ({ label: p.name, value: p.id }));
  }
}

onMounted(async () => {
  loadProductOptions();
  const id = route.params.id as string;
  if (id && id !== 'create') {
    isEdit.value = true;
    loading.value = true;
    const { data, error } = await fetchBanner(Number(id));
    if (!error && data) {
      form.value = {
        imageUrl: data.imageUrl,
        title: data.title,
        subtitle: data.subtitle,
        tag: data.tag,
        linkType: data.linkType,
        linkProductId: data.linkProductId,
        sortOrder: data.sortOrder,
      };
    }
    loading.value = false;
  }
});

async function handleSave() {
  saving.value = true;
  const id = route.params.id as string;
  const payload = { ...form.value };
  if (payload.linkType === 'none') payload.linkProductId = null;

  let error: any;
  if (isEdit.value) {
    const res = await fetchUpdateBanner(Number(id), payload);
    error = res.error;
  } else {
    const res = await fetchCreateBanner(payload);
    error = res.error;
  }

  saving.value = false;
  if (!error) {
    window.$message?.success(isEdit.value ? '轮播图已更新' : '轮播图已创建');
    router.push('/banners/list');
  }
}
</script>

<template>
  <div class="banners-form">
    <div class="page-header">
      <h2 class="page-title">{{ isEdit ? '编辑轮播图' : '新建轮播图' }}</h2>
    </div>

    <NSpin :show="loading">
      <NForm label-placement="left" label-width="100" style="max-width: 640px;">
        <NFormItem label="轮播图片" required>
          <ImageUpload v-model="form.imageUrl" />
        </NFormItem>
        <NFormItem label="标题">
          <NInput v-model:value="form.title" placeholder="轮播图标题" />
        </NFormItem>
        <NFormItem label="副标题">
          <NInput v-model:value="form.subtitle" placeholder="轮播图副标题" />
        </NFormItem>
        <NFormItem label="标签">
          <NInput v-model:value="form.tag" placeholder="如：🔥 新品" />
        </NFormItem>
        <NFormItem label="链接类型">
          <NSelect v-model:value="form.linkType" :options="linkTypeOptions" style="width: 200px" />
        </NFormItem>
        <NFormItem label="关联商品" v-if="form.linkType === 'product'">
          <NSelect
            v-model:value="form.linkProductId"
            :options="productOptions"
            placeholder="选择关联商品"
            filterable
            style="width: 300px"
          />
        </NFormItem>
        <NFormItem label="排序">
          <NInputNumber v-model:value="form.sortOrder" :min="0" style="width: 120px" />
        </NFormItem>

        <NFormItem>
          <NSpace>
            <NButton type="primary" :loading="saving" @click="handleSave">{{ isEdit ? '保存修改' : '创建' }}</NButton>
            <NButton @click="router.push('/banners/list')">取消</NButton>
          </NSpace>
        </NFormItem>
      </NForm>
    </NSpin>
  </div>
</template>

<style scoped>
.banners-form { padding: 4px; }
.page-header { margin-bottom: 24px; }
</style>
