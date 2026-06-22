<script setup lang="ts">
import { ref, onMounted, h } from 'vue';
import { useRouter } from 'vue-router';
import { NCard, NDataTable, NButton, NTag, NSpace, NIcon, NSwitch, useDialog, NForm, NFormItem, NInputNumber } from 'naive-ui';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@vicons/antd';
import type { DataTableColumns } from 'naive-ui';
import { fetchLuckyPrizes, fetchDeleteLuckyPrize, fetchToggleLuckyPrize, fetchLuckyConfig, fetchUpdateLuckyConfig } from '@/service/api';
import type { LuckyPrize, LuckyConfig } from '@/service/api';

defineOptions({ name: 'LuckyWheelPrizesList' });

const router = useRouter();
const dialog = useDialog();
const prizes = ref<LuckyPrize[]>([]);
const loading = ref(false);

const typeMap: Record<string, { label: string; type: 'success' | 'info' | 'warning' | 'error' | 'default' }> = {
  coupon: { label: '优惠券', type: 'success' },
  points: { label: '积分', type: 'info' },
  balance: { label: '余额', type: 'warning' },
  thanks: { label: '谢谢参与', type: 'default' },
  again: { label: '再来一次', type: 'error' },
};

function rewardText(row: LuckyPrize): string {
  if (row.type === 'coupon') return row.couponTemplateId ? `券模板#${row.couponTemplateId}` : '(未配置)';
  if (row.type === 'points') return `${row.pointsAmount ?? 0} 积分`;
  if (row.type === 'balance') return `¥${Number(row.balanceAmount ?? 0).toFixed(2)}`;
  return '—';
}

const columns: DataTableColumns<LuckyPrize> = [
  { title: 'ID', key: 'id', width: 60, align: 'center' },
  {
    title: '类型', key: 'type', width: 90,
    render(row) {
      const m = typeMap[row.type] || { label: row.type, type: 'default' as const };
      return h(NTag, { type: m.type, size: 'small', bordered: false }, () => m.label);
    }
  },
  { title: '名称', key: 'name', width: 140 },
  { title: '权重', key: 'weight', width: 70, align: 'center' },
  {
    title: '奖励', key: 'reward', width: 110,
    render(row) { return rewardText(row); }
  },
  {
    title: '已发/库存', key: 'stock', width: 100, align: 'center',
    render(row) {
      const stock = row.stock == null ? '∞' : row.stock;
      return `${row.awardedCount ?? 0}/${stock}`;
    }
  },
  { title: '排序', key: 'sortOrder', width: 70, align: 'center' },
  {
    title: '状态', key: 'isActive', width: 80, align: 'center',
    render(row) {
      return h(NSwitch, {
        value: !!row.isActive,
        onUpdateValue: () => handleToggle(row.id, !row.isActive),
      });
    }
  },
  {
    title: '操作', key: 'actions', width: 120,
    render(row) {
      return h(NSpace, null, {
        default: () => [
          h(NButton, { size: 'small', quaternary: true, onClick: () => router.push(`/lucky-wheel/prizes/${row.id}/edit`) }, { icon: () => h(NIcon, null, () => h(EditOutlined)) }),
          h(NButton, { size: 'small', quaternary: true, type: 'error', onClick: () => handleDelete(row.id, row.name) }, { icon: () => h(NIcon, null, () => h(DeleteOutlined)) }),
        ]
      });
    }
  },
];

async function loadPrizes() {
  loading.value = true;
  const { data, error } = await fetchLuckyPrizes();
  if (!error && data) prizes.value = data;
  loading.value = false;
}

async function handleToggle(id: number, val: boolean) {
  const { error } = await fetchToggleLuckyPrize(id);
  if (error) { window.$message?.error('切换状态失败'); return; }
  window.$message?.success(val ? '已启用' : '已禁用');
  loadPrizes();
}

async function handleDelete(id: number, name: string) {
  dialog.warning({
    title: '确认删除',
    content: `确定删除奖品「${name}」？已抽中的记录会保留（关联置空）。`,
    positiveText: '确认删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      const { error } = await fetchDeleteLuckyPrize(id);
      if (!error) { window.$message?.success('奖品已删除'); loadPrizes(); }
    },
  });
}

// ── 抽奖规则 config ──
const config = ref<LuckyConfig>({ enabled: true, freePerDay: 1, pointsCost: 50, maxPerDay: 10 });
const savingConfig = ref(false);

async function loadConfig() {
  const { data, error } = await fetchLuckyConfig();
  if (!error && data) config.value = data;
}

async function saveConfig() {
  savingConfig.value = true;
  const { error } = await fetchUpdateLuckyConfig(config.value);
  savingConfig.value = false;
  if (!error) window.$message?.success('规则已保存');
}

onMounted(() => { loadPrizes(); loadConfig(); });
</script>

<template>
  <NSpace vertical :size="16">
    <NCard title="抽奖规则" :bordered="false" class="card-wrapper">
      <NForm inline label-placement="left" label-width="auto">
        <NFormItem label="启用转盘">
          <NSwitch v-model:value="config.enabled" />
        </NFormItem>
        <NFormItem label="每日免费次数">
          <NInputNumber v-model:value="config.freePerDay" :min="0" style="width: 120px" />
        </NFormItem>
        <NFormItem label="加抽消耗积分">
          <NInputNumber v-model:value="config.pointsCost" :min="0" style="width: 120px" />
        </NFormItem>
        <NFormItem label="每日上限">
          <NInputNumber v-model:value="config.maxPerDay" :min="1" style="width: 120px" />
        </NFormItem>
        <NFormItem>
          <NButton type="primary" :loading="savingConfig" @click="saveConfig">保存规则</NButton>
        </NFormItem>
      </NForm>
    </NCard>

    <NCard title="奖品列表" :bordered="false" class="card-wrapper">
      <template #header-extra>
        <NButton type="primary" @click="router.push('/lucky-wheel/prizes/create')">
          <template #icon><NIcon><PlusOutlined /></NIcon></template>
          新建奖品
        </NButton>
      </template>
      <NDataTable :columns="columns" :data="prizes" :loading="loading" :row-key="(r: LuckyPrize) => r.id" />
    </NCard>
  </NSpace>
</template>

<style scoped></style>
