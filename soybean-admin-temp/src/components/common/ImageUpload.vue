<script setup lang="ts">
import { ref, watch } from 'vue';
import { NImage, NSpin, NIcon, NButton } from 'naive-ui';
import { fetchUploadImage } from '@/service/api/upload';

defineOptions({ name: 'ImageUpload' });

const props = withDefaults(
  defineProps<{
    modelValue: string;
    width?: number;
    height?: number;
  }>(),
  {
    width: 160,
    height: 160,
  },
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const uploading = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

const imgStyle = {
  width: `${props.width}px`,
  height: `${props.height}px`,
};

const dropStyle = {
  width: `${props.width}px`,
  height: `${props.height}px`,
};

function triggerUpload() {
  fileInput.value?.click();
}

async function handleFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  // Client-side validation
  const validMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!validMimes.includes(file.type)) {
    window.$message?.warning('仅支持 JPG/PNG/GIF/WebP 图片');
    input.value = '';
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    window.$message?.warning(`图片过大（${(file.size / 1024 / 1024).toFixed(1)}MB），最大 5MB`);
    input.value = '';
    return;
  }

  uploading.value = true;
  const { data, error } = await fetchUploadImage(file);
  uploading.value = false;
  input.value = '';

  if (!error && data) {
    emit('update:modelValue', data.url);
    window.$message?.success('上传成功');
  } else {
    window.$message?.error(error?.message || '上传失败');
  }
}

function handleDelete() {
  emit('update:modelValue', '');
}
</script>

<template>
  <div class="image-upload">
    <!-- Empty / upload trigger -->
    <div
      v-if="!modelValue"
      class="upload-dropzone select-none"
      :style="dropStyle"
      role="button"
      tabindex="0"
      @click="triggerUpload"
    >
      <NSpin :show="uploading" size="small">
        <div class="flex flex-col items-center gap-1">
          <span class="text-3xl opacity-30 i-mdi:cloud-upload-outline"></span>
          <span class="text-xs opacity-50">{{ uploading ? '上传中…' : '点击上传图片' }}</span>
          <span class="text-xs opacity-30">JPG/PNG/GIF/WebP · 单边≤4096px · ≤5MB</span>
        </div>
      </NSpin>
    </div>

    <!-- Preview + actions -->
    <div v-else class="upload-preview relative inline-block">
      <NImage
        :src="modelValue"
        :width="width"
        :height="height"
        object-fit="cover"
        class="rounded-md overflow-hidden"
        fallback-src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23ccc' d='M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z'/%3E%3C/svg%3E"
        :preview-disabled="true"
      />
      <!-- Hover actions overlay -->
      <div class="upload-overlay absolute inset-0 flex items-center justify-center gap-1 bg-black/40 opacity-0 hover:opacity-100 transition-opacity rounded-md">
        <NButton size="tiny" circle secondary @click="triggerUpload" title="重新上传">
          <template #icon>
            <span class="i-mdi:reload text-sm"></span>
          </template>
        </NButton>
        <NButton size="tiny" circle secondary type="error" @click="handleDelete" title="删除图片">
          <template #icon>
            <span class="i-mdi:delete-outline text-sm"></span>
          </template>
        </NButton>
      </div>
    </div>

    <!-- Hidden file input -->
    <input
      ref="fileInput"
      type="file"
      accept="image/jpeg,image/png,image/gif,image/webp"
      class="hidden"
      @change="handleFileChange"
    />
  </div>
</template>

<style scoped>
.upload-dropzone {
  border: 2px dashed var(--n-border-color);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: border-color 0.2s;
}
.upload-dropzone:hover {
  border-color: var(--primary-color, #D32F2F);
}
.upload-overlay {
  transition: opacity 0.2s;
}
</style>
