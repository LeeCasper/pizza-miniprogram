<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { productApi, type Product } from '@/service/api/product'
import AdminLayout from '@/components/AdminLayout.vue'
import { NForm, NFormItem, NInput, NInputNumber, NSelect, NSpace, NButton, NCard, useMessage, NDivider, NTag, NCollapse, NCollapseItem } from 'naive-ui'
import ImageUpload from '@/components/ImageUpload.vue'

const router = useRouter()
const route = useRoute()
const message = useMessage()
const isEdit = computed(() => !!route.params.id)
const loading = ref(false)

const categoryOptions = [
  { label: '🍕 披萨', value: 'pizza' },
  { label: '🍈 榴莲', value: 'durian' },
  { label: '🍍 菠萝', value: 'pineapple' },
]
const tagOptions = [
  { label: '🔥 热卖', value: 'hot' },
  { label: '⭐ 推荐', value: 'recommend' },
  { label: '🆕 新品', value: 'new' },
  { label: '🧀 经典', value: 'classic' },
  { label: '🌿 素食', value: 'veggie' },
  { label: '🥩 肉食', value: 'meat' },
]
const availableOptions = [
  { label: '在售', value: 1 },
  { label: '下架', value: 0 },
]

const form = ref({
  name: '',
  category_key: 'pizza',
  price: undefined as number | undefined,
  image: '',
  tag: '',
  size_desc: '',
  desc: '',
  detail_desc: '',
  ingredients: [] as string[],
  is_available: 1,
})

const ingredientInput = ref('')

onMounted(async () => {
  if (isEdit.value) {
    loading.value = true
    try {
      const res = await productApi.get(Number(route.params.id))
      if (res.code === 0) {
        const p = res.data
        form.value = {
          name: p.name || '',
          category_key: p.category_key || 'pizza',
          price: p.price,
          image: p.image || '',
          tag: p.tag || '',
          size_desc: p.size_desc || '',
          desc: p.desc || '',
          detail_desc: p.detail_desc || '',
          ingredients: p.ingredients || [],
          is_available: p.is_available,
        }
      }
    } catch { message.error('加载商品失败') }
    finally { loading.value = false }
  }
})

function addIngredient() {
  const val = ingredientInput.value.trim()
  if (val && !form.value.ingredients.includes(val)) {
    form.value.ingredients.push(val)
    ingredientInput.value = ''
  }
}

function removeIngredient(idx: number) {
  form.value.ingredients.splice(idx, 1)
}

async function handleSubmit() {
  if (!form.value.name || !form.value.price) {
    message.warning('请填写商品名称和价格')
    return
  }
  loading.value = true
  try {
    if (isEdit.value) {
      await productApi.update(Number(route.params.id), form.value)
      message.success('商品已更新')
    } else {
      await productApi.create(form.value)
      message.success('商品已创建')
    }
    router.push('/products')
  } catch (err: any) {
    message.error(err.response?.data?.message || '保存失败')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AdminLayout>
    <h2 class="page-title">{{ isEdit ? '编辑商品' : '新建商品' }}</h2>
    <NCard>
      <NForm
        :model="form"
        label-placement="top"
        size="medium"
        :style="{ maxWidth: '640px' }"
      >
        <NFormItem label="商品名称" required>
          <NInput v-model:value="form.name" placeholder="例：招牌玛格丽特" />
        </NFormItem>

        <NFormItem label="分类" required>
          <NSelect v-model:value="form.category_key" :options="categoryOptions" />
        </NFormItem>

        <NFormItem label="价格 (¥)" required>
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
          <NSelect v-model:value="form.tag" :options="tagOptions" clearable placeholder="选择标签" />
        </NFormItem>

        <NFormItem label="规格描述">
          <NInput v-model:value="form.size_desc" placeholder="例：9寸/12寸" />
        </NFormItem>

        <NFormItem label="简介">
          <NInput v-model:value="form.desc" type="textarea" placeholder="简短描述" />
        </NFormItem>

        <NFormItem label="详情">
          <NInput v-model:value="form.detail_desc" type="textarea" placeholder="详细描述" :autosize="{ minRows: 3 }" />
        </NFormItem>

        <NDivider />
        <NFormItem label="食材/忌口标签">
          <NSpace>
            <NInput v-model:value="ingredientInput" placeholder="输入食材名" style="width:200px" @keyup.enter="addIngredient" />
            <NButton size="small" @click="addIngredient">添加</NButton>
          </NSpace>
          <NSpace style="margin-top:8px">
            <NTag
              v-for="(item, idx) in form.ingredients"
              :key="idx"
              closable
              @close="removeIngredient(idx)"
            >
              {{ item }}
            </NTag>
          </NSpace>
        </NFormItem>

        <NFormItem v-if="isEdit" label="状态">
          <NSelect v-model:value="form.is_available" :options="availableOptions" style="width:120px" />
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
  </AdminLayout>
</template>

<style scoped>
.page-title { margin: 0 0 16px; font-size: 20px; font-weight: 600; }
</style>
