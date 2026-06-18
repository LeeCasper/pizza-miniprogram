<script setup lang="ts">
import { ref, onMounted, h } from 'vue';
import {
  NCard, NGrid, NGridItem, NButton, NSpin, NImage,
  NModal, NSpace, NPopconfirm, NPagination,
} from 'naive-ui';
import { fetchFileList, fetchDeleteFile, fetchUploadImage, type FileItem } from '@/service/api/upload';

defineOptions({ name: 'FileList' });

const loading = ref(false);
const files = ref<FileItem[]>([]);
const page = ref(1);
const total = ref(0);
const limit = 20;
const previewUrl = ref<string | null>(null);
const previewVisible = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

async function loadFiles() {
  loading.value = true;
  const { data, error } = await fetchFileList(page.value, limit);
  if (!error && data) {
    files.value = data.items;
    total.value = data.total;
  }
  loading.value = false;
}

async function handleDelete(filename: string) {
  const { error } = await fetchDeleteFile(filename);
  if (!error) {
    window.$message?.success('删除成功');
    await loadFiles();
  }
}

function handleCopy(url: string) {
  const fullUrl = window.location.origin + url;
  navigator.clipboard.writeText(fullUrl).then(
    () => window.$message?.success('已复制: ' + fullUrl),
    () => window.$message?.warning('复制失败，请手动复制'),
  );
}

function handlePreview(url: string) {
  previewUrl.value = url;
  previewVisible.value = true;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function triggerUpload() {
  fileInput.value?.click();
}

async function handleUpload(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  const { error } = await fetchUploadImage(file);
  if (!error) {
    window.$message?.success('上传成功');
    await loadFiles();
  }
  input.value = '';
}

function handlePageChange(p: number) {
  page.value = p;
  loadFiles();
}

onMounted(() => { loadFiles(); });
</script>

<template>
  <div class="files-page">
    <div class="page-header">
      <h2 class="page-title">文件管理</h2>
      <NButton type="primary" @click="triggerUpload">
        <template #icon>
          <span class="i-mdi:cloud-upload-outline text-18px"></span>
        </template>
        上传图片
      </NButton>
      <input
        ref="fileInput"
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        class="hidden"
        @change="handleUpload"
      />
    </div>

    <NSpin :show="loading">
      <NGrid v-if="files.length > 0" cols="s:2 m:3 l:4 xl:5" :x-gap="12" :y-gap="12">
        <NGridItem v-for="file in files" :key="file.name">
          <NCard class="file-card" hoverable size="small">
            <div class="file-preview cursor-pointer" @click="handlePreview(file.url)">
              <NImage
                :src="file.url"
                :width="160"
                :height="120"
                object-fit="cover"
                fallback-src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23ccc' d='M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z'/%3E%3C/svg%3E"
                :preview-disabled="true"
              />
            </div>
            <div class="file-info">
              <div class="file-name truncate text-12px" :title="file.name">{{ file.name }}</div>
              <div class="file-meta flex justify-between text-11px text-gray-400">
                <span>{{ formatSize(file.size) }}</span>
                <span>{{ formatDate(file.lastModified) }}</span>
              </div>
              <NSpace justify="end" :size="4" class="mt-1">
                <NButton size="tiny" quaternary @click="handleCopy(file.url)" title="复制链接">
                  <template #icon>
                    <span class="i-mdi:content-copy text-14px"></span>
                  </template>
                </NButton>
                <NPopconfirm @positive-click="handleDelete(file.name)">
                  <template #trigger>
                    <NButton size="tiny" quaternary type="error" title="删除">
                      <template #icon>
                        <span class="i-mdi:delete-outline text-14px"></span>
                      </template>
                    </NButton>
                  </template>
                  确认删除此文件？
                </NPopconfirm>
              </NSpace>
            </div>
          </NCard>
        </NGridItem>
      </NGrid>

      <!-- Empty state -->
      <div v-if="!loading && files.length === 0" class="empty-state">
        <span class="i-mdi:file-image-outline text-48px text-gray-300"></span>
        <p class="text-14px text-gray-400 mt-3">暂无上传文件</p>
      </div>

      <!-- Pagination -->
      <div v-if="total > limit" class="flex justify-center mt-5 pb-5">
        <NPagination
          :page="page"
          :page-size="limit"
          :item-count="total"
          @update:page="handlePageChange"
        />
      </div>
    </NSpin>

    <!-- Preview modal -->
    <NModal v-model:show="previewVisible" title="图片预览">
      <div class="flex items-center justify-center">
        <img v-if="previewUrl" :src="previewUrl" class="max-w-80vw max-h-70vh rounded-lg" />
      </div>
    </NModal>
  </div>
</template>

<style scoped>
.files-page { padding: 4px; }
.file-info { display: flex; flex-direction: column; gap: 4px; }
.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px 0; }
</style>
