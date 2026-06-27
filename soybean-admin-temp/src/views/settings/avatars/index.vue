<template>
  <NCard title="默认头像管理" :bordered="false" size="small">
    <template #header-extra>
      <NButton type="primary" @click="triggerUpload">
        <template #icon>
          <span style="font-size: 18px; margin-right: 4px">+</span>
        </template>
        添加头像
      </NButton>
    </template>

    <NSpin :show="loading">
      <NEmpty v-if="!loading && list.length === 0" description="暂无默认头像，点击上方按钮添加" />

      <NGrid v-else cols="s:2 m:3 l:5" :x-gap="16" :y-gap="16" responsive="screen">
        <NGi v-for="item in list" :key="item.id">
          <div class="avatar-card">
            <div class="avatar-img-wrap">
              <img :src="item.url" class="avatar-img" />
              <div class="avatar-actions">
                <NButton size="tiny" type="error" @click="handleDelete(item)" :loading="deletingId === item.id">
                  删除
                </NButton>
              </div>
            </div>
          </div>
        </NGi>
      </NGrid>
    </NSpin>
  </NCard>

  <NCard title="功能说明" :bordered="false" size="small" class="mt-4">
    <ul class="text-sm text-gray-500 leading-6">
      <li>用户通过「微信一键登录」绑定手机号后，若未设置过头像，系统将从这里随机分配一个默认头像。</li>
      <li>最多可上传 <strong>10</strong> 个默认头像，超出需先删除旧的。</li>
      <li>图片建议尺寸：200×200 像素，支持 PNG / JPEG 格式。</li>
      <li>删除默认头像不会影响已分配该头像的用户。</li>
    </ul>
  </NCard>

  <!-- Hidden file input for upload -->
  <input
    ref="fileInputRef"
    type="file"
    accept="image/png,image/jpeg,image/gif,image/webp"
    style="display: none"
    @change="handleFileChange"
  />
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import {
  NCard,
  NButton,
  NSpin,
  NGrid,
  NGi,
  NEmpty,
  NTag,
  useMessage,
  useDialog,
} from 'naive-ui';
import { fetchDefaultAvatars, fetchAddDefaultAvatar, fetchDeleteDefaultAvatar } from '@/service/api';

defineOptions({ name: 'SettingsAvatars' });

const message = useMessage();
const dialog = useDialog();
const loading = ref(false);
const deletingId = ref<number | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);

interface AvatarItem {
  id: number;
  url: string;
}

const list = ref<AvatarItem[]>([]);

onMounted(async () => {
  await loadList();
});

async function loadList() {
  loading.value = true;
  const { data, error } = await fetchDefaultAvatars();
  if (!error && data) {
    list.value = data;
  }
  loading.value = false;
}

function triggerUpload() {
  if (list.value.length >= 10) {
    message.warning('默认头像最多10个，请先删除旧的再添加');
    return;
  }
  fileInputRef.value?.click();
}

async function handleFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  // Validate file type
  if (!['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(file.type)) {
    message.error('仅支持 PNG / JPEG / GIF / WebP 格式');
    input.value = '';
    return;
  }

  // Validate file size (max 2MB)
  if (file.size > 2 * 1024 * 1024) {
    message.error('图片大小不能超过 2MB');
    input.value = '';
    return;
  }

  const formData = new FormData();
  formData.append('file', file);

  loading.value = true;
  try {
    const token = localStorage.getItem('token') || '';
    const resp = await fetch('/api/v1/admin/default-avatars', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const result = await resp.json();
    if (result.code === 0) {
      message.success('添加成功');
      await loadList();
    } else {
      message.error(result.message || '添加失败');
    }
  } catch {
    message.error('上传失败，请重试');
  } finally {
    loading.value = false;
    input.value = '';
  }
}

function handleDelete(item: AvatarItem) {
  dialog.warning({
    title: '确认删除',
    content: '删除后，新用户将不会再被分配此头像。已分配此头像的用户不受影响。',
    positiveText: '确认删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      deletingId.value = item.id;
      const { error } = await fetchDeleteDefaultAvatar(item.id);
      if (!error) {
        message.success('已删除');
        await loadList();
      } else {
        message.error('删除失败');
      }
      deletingId.value = null;
    },
  });
}
</script>

<style scoped>
.mt-4 {
  margin-top: 16px;
}

.avatar-card {
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  background: var(--n-color-target);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  transition: box-shadow 0.2s;
}

.avatar-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}

.avatar-img-wrap {
  position: relative;
  width: 100%;
  padding-bottom: 100%;
  overflow: hidden;
}

.avatar-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-actions {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 12px;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.5));
  display: flex;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
}

.avatar-card:hover .avatar-actions {
  opacity: 1;
}
</style>
