<script setup lang="ts">
import { ref } from 'vue'
import { NSpin, NIcon, NButton, useMessage } from 'naive-ui'
import { CloudUploadOutlined, DeleteOutlined, ReloadOutlined } from '@vicons/antd'
import { uploadApi } from '@/service/api/upload'

const props = withDefaults(
  defineProps<{
    modelValue: string
    width?: number
    height?: number
  }>(),
  {
    modelValue: '',
    width: 160,
    height: 160,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const message = useMessage()
const uploading = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

function triggerUpload() {
  fileInput.value?.click()
}

async function handleFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  // Validate type client-side
  const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  if (!allowed.includes(file.type)) {
    message.warning('仅支持 JPG/PNG/GIF/WebP 格式')
    input.value = ''
    return
  }

  uploading.value = true
  try {
    const res = await uploadApi.upload(file)
    if (res.code === 0) {
      emit('update:modelValue', res.data.url)
      message.success('上传成功')
    } else {
      message.error(res.message || '上传失败')
    }
  } catch (err: any) {
    message.error(err.response?.data?.message || '上传失败，请重试')
  } finally {
    uploading.value = false
    input.value = ''
  }
}

function handleDelete() {
  emit('update:modelValue', '')
}
</script>

<template>
  <div class="image-upload" :style="{ width: `${props.width}px`, height: `${props.height}px` }">
    <!-- Empty state: upload area -->
    <div
      v-if="!modelValue && !uploading"
      class="upload-area"
      :style="{ width: `${props.width}px`, height: `${props.height}px` }"
      @click="triggerUpload"
    >
      <NIcon size="32" color="#999">
        <CloudUploadOutlined />
      </NIcon>
      <span class="upload-text">点击上传</span>
    </div>

    <!-- Uploading state -->
    <div v-if="uploading" class="upload-area uploading" :style="{ width: `${props.width}px`, height: `${props.height}px` }">
      <NSpin size="medium" />
    </div>

    <!-- Uploaded state: preview image -->
    <div
      v-if="modelValue && !uploading"
      class="preview-wrap"
      :style="{ width: `${props.width}px`, height: `${props.height}px` }"
    >
      <img :src="modelValue" class="preview-img" alt="preview" />
      <div class="preview-actions">
        <NButton size="tiny" circle type="error" @click.stop="handleDelete" title="删除图片">
          <template #icon>
            <NIcon><DeleteOutlined /></NIcon>
          </template>
        </NButton>
        <NButton size="tiny" circle @click.stop="triggerUpload" title="更换图片">
          <template #icon>
            <NIcon><ReloadOutlined /></NIcon>
          </template>
        </NButton>
      </div>
    </div>

    <!-- Hidden file input -->
    <input
      ref="fileInput"
      type="file"
      accept="image/jpeg,image/png,image/gif,image/webp"
      class="file-input-hidden"
      @change="handleFileChange"
    />
  </div>
</template>

<style scoped>
.image-upload {
  position: relative;
}

.upload-area {
  border: 2px dashed #d9d9d9;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  background: #fafafa;
  transition: border-color 0.2s, background 0.2s;
}

.upload-area:hover {
  border-color: #D32F2F;
  background: rgba(211, 47, 47, 0.04);
}

.upload-area.uploading {
  cursor: default;
  border-color: #d9d9d9;
  background: #fafafa;
}

.upload-text {
  font-size: 12px;
  color: #999;
}

.preview-wrap {
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #e8e8e8;
}

.preview-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.preview-actions {
  position: absolute;
  top: 6px;
  right: 6px;
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}

.preview-wrap:hover .preview-actions {
  opacity: 1;
}

.preview-actions::before {
  content: '';
  position: absolute;
  inset: -4px;
  background: rgba(0, 0, 0, 0.35);
  border-radius: 6px;
  z-index: -1;
}

.file-input-hidden {
  display: none;
}
</style>
