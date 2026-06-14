<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { uploadApi, type FileItem } from '@/service/api/upload'
import AdminLayout from '@/components/AdminLayout.vue'
import {
  NCard, NGrid, NGridItem, NButton, NIcon, NSpin, NImage,
  NModal, NSpace, NPopconfirm, useMessage, NPagination,
} from 'naive-ui'
import {
  CopyOutlined, DeleteOutlined, FileImageOutlined, CloudUploadOutlined,
} from '@vicons/antd'

const message = useMessage()
const loading = ref(false)
const files = ref<FileItem[]>([])
const page = ref(1)
const total = ref(0)
const limit = 20
const previewUrl = ref<string | null>(null)
const previewVisible = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

async function fetchFiles() {
  loading.value = true
  try {
    const res = await uploadApi.listFiles(page.value, limit)
    if (res.code === 0) {
      files.value = res.data.items
      total.value = res.data.total
    }
  } catch (err: any) {
    message.error(err.response?.data?.message || '加载文件列表失败')
  } finally {
    loading.value = false
  }
}

async function handleDelete(filename: string) {
  try {
    const res = await uploadApi.deleteFile(filename)
    if (res.code === 0) {
      message.success('删除成功')
      await fetchFiles()
    } else {
      message.error(res.message || '删除失败')
    }
  } catch (err: any) {
    message.error(err.response?.data?.message || '删除失败')
  }
}

function handleCopy(url: string) {
  const fullUrl = window.location.origin + url
  navigator.clipboard.writeText(fullUrl).then(
    () => message.success('已复制地址: ' + fullUrl),
    () => message.warning('复制失败，请手动复制'),
  )
}

function handlePreview(url: string) {
  previewUrl.value = url
  previewVisible.value = true
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Quick upload from file manager
function triggerUpload() {
  fileInput.value?.click()
}

async function handleUpload(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    const res = await uploadApi.upload(file)
    if (res.code === 0) {
      message.success('上传成功')
      await fetchFiles()
    } else {
      message.error(res.message || '上传失败')
    }
  } catch (err: any) {
    message.error(err.response?.data?.message || '上传失败')
  } finally {
    input.value = ''
  }
}

function handlePageChange(p: number) {
  page.value = p
  fetchFiles()
}

onMounted(() => {
  fetchFiles()
})
</script>

<template>
  <AdminLayout>
    <div class="page-header">
      <h2 class="page-title">文件管理</h2>
      <NButton type="primary" @click="triggerUpload">
        <template #icon>
          <NIcon><CloudUploadOutlined /></NIcon>
        </template>
        上传图片
      </NButton>
      <input
        ref="fileInput"
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        style="display:none"
        @change="handleUpload"
      />
    </div>

    <NSpin :show="loading">
      <NGrid v-if="files.length > 0" cols="s:2 m:3 l:4 xl:5" :x-gap="12" :y-gap="12">
        <NGridItem v-for="file in files" :key="file.name">
          <NCard class="file-card" hoverable size="small">
            <div class="file-preview" @click="handlePreview(file.url)">
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
              <div class="file-name" :title="file.name">{{ file.name }}</div>
              <div class="file-meta">
                <span>{{ formatSize(file.size) }}</span>
                <span>{{ formatDate(file.lastModified) }}</span>
              </div>
              <NSpace justify="end" :size="4" class="file-actions">
                <NButton size="tiny" quaternary @click="handleCopy(file.url)" title="复制链接">
                  <template #icon>
                    <NIcon><CopyOutlined /></NIcon>
                  </template>
                </NButton>
                <NPopconfirm @positive-click="handleDelete(file.name)">
                  <template #trigger>
                    <NButton size="tiny" quaternary type="error" title="删除">
                      <template #icon>
                        <NIcon><DeleteOutlined /></NIcon>
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
        <NIcon size="48" color="#ccc">
          <FileImageOutlined />
        </NIcon>
        <p>暂无上传文件</p>
      </div>

      <!-- Pagination -->
      <div v-if="total > limit" class="pagination-wrap">
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
      <div class="modal-preview">
        <img v-if="previewUrl" :src="previewUrl" style="max-width:80vw;max-height:70vh;border-radius:8px" />
      </div>
    </NModal>
  </AdminLayout>
</template>

<style scoped>
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.page-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}
.file-card {
  cursor: default;
}
.file-preview {
  cursor: pointer;
  overflow: hidden;
  border-radius: 6px;
  margin-bottom: 8px;
}
.file-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.file-name {
  font-size: 12px;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.file-meta {
  font-size: 11px;
  color: #999;
  display: flex;
  justify-content: space-between;
}
.file-actions {
  margin-top: 4px;
}
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 0;
  color: #999;
}
.empty-state p {
  margin-top: 12px;
  font-size: 14px;
}
.pagination-wrap {
  display: flex;
  justify-content: center;
  margin-top: 20px;
  padding-bottom: 20px;
}
.modal-preview {
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
