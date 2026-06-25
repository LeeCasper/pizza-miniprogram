<script setup lang="ts">
import { ref } from 'vue';
import { NButton, NImage, NSpin } from 'naive-ui';
import { fetchUploadImage } from '@/service/api/upload';

defineOptions({ name: 'MultiImageUpload' });

const props = withDefaults(
  defineProps<{
    modelValue: string[];
    width?: number;
    height?: number;
    max?: number;
  }>(),
  {
    width: 120,
    height: 120,
    max: 5,
  },
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: string[]): void;
}>();

const uploading = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

const tileStyle = {
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

  const validMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!validMimes.includes(file.type)) {
    window.$message?.warning('仅支持 JPG/PNG/GIF/WebP 图片');
    input.value = '';
    return;
  }

  uploading.value = true;
  const { data, error } = await fetchUploadImage(file);
  uploading.value = false;
  input.value = '';

  if (!error && data) {
    emit('update:modelValue', [...props.modelValue, data.url]);
    window.$message?.success('上传成功');
  } else {
    window.$message?.error(error?.message || '上传失败');
  }
}

function handleRemove(index: number) {
  const next = props.modelValue.slice();
  next.splice(index, 1);
  emit('update:modelValue', next);
}
</script>

<template>
  <div class="multi-image-upload flex flex-wrap gap-2">
    <div
      v-for="(url, index) in modelValue"
      :key="index"
      class="upload-preview relative inline-block"
    >
      <NImage
        :src="url"
        :width="width"
        :height="height"
        object-fit="cover"
        class="rounded-md overflow-hidden"
        :preview-disabled="true"
      />
      <div class="upload-overlay absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity rounded-md">
        <NButton size="tiny" circle secondary type="error" title="删除图片" @click="handleRemove(index)">
          <template #icon>
            <span class="i-mdi:delete-outline text-sm"></span>
          </template>
        </NButton>
      </div>
    </div>

    <div
      v-if="modelValue.length < max"
      class="upload-dropzone select-none"
      :style="tileStyle"
      role="button"
      tabindex="0"
      @click="triggerUpload"
    >
      <NSpin :show="uploading" size="small">
        <div class="flex flex-col items-center gap-1">
          <span class="text-3xl opacity-30 i-mdi:cloud-upload-outline"></span>
          <span class="text-xs opacity-50">{{ uploading ? '上传中…' : '添加图片' }}</span>
        </div>
      </NSpin>
    </div>

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
