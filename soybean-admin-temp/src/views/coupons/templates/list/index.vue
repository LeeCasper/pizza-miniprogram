<script setup lang="ts">
import { ref, onMounted, h } from 'vue';
import { useRouter } from 'vue-router';
import { NCard, NDataTable, NButton, NTag, NSpace, NIcon, NSwitch, useDialog, NDrawer, NDrawerContent, NForm, NFormItem, NSelect, NTransfer } from 'naive-ui';
import { PlusOutlined, EditOutlined, DeleteOutlined, SendOutlined } from '@vicons/antd';
import type { DataTableColumns } from 'naive-ui';
import { fetchCouponTemplates, fetchDeleteCouponTemplate, fetchToggleCouponTemplate, fetchAssignCoupon, fetchUsers } from '@/service/api';
import type { CouponTemplate } from '@/service/api';
import { formatPrice } from '@/utils/format';

defineOptions({ name: 'CouponTemplatesList' });

const router = useRouter();
const dialog = useDialog();
const templates = ref<CouponTemplate[]>([]);
const loading = ref(false);

const categoryMap: Record<string, { label: string; type: 'info' | 'success' }> = {
  discount: { label: '满减券', type: 'success' },
  redeem: { label: '兑换券', type: 'info' },
};

const discountTypeMap: Record<string, string> = {
  free_redeem: '免费兑换',
  buy_one_get_one: '买一赠一',
  free_delivery: '免配送费',
  half_price: '半价',
  fixed_amount: '固定金额',
};

const columns: DataTableColumns<CouponTemplate> = [
  { title: 'ID', key: 'id', width: 60, align: 'center' },
  { title: '名称', key: 'name', width: 160 },
  {
    title: '类别', key: 'category', width: 80,
    render(row) {
      const m = categoryMap[row.category] || { label: row.category, type: 'default' as const };
      return h(NTag, { type: m.type, size: 'small', bordered: false }, () => m.label);
    }
  },
  { title: '面值', key: 'value', width: 100 },
  {
    title: '优惠类型', key: 'discountType', width: 90,
    render(row) { return discountTypeMap[row.discountType] || row.discountType; }
  },
  { title: '最低消费', key: 'minSpend', width: 90, render(row) { return formatPrice(row.minSpend); } },
  { title: '有效天数', key: 'validDays', width: 80, render(row) { return `${row.validDays}天`; } },
  {
    title: '状态', key: 'isActive', width: 80,
    render(row) {
      return h(NSwitch, {
        value: !!row.isActive,
        onUpdateValue: (val: boolean) => handleToggle(row.id!, val),
      });
    }
  },
  {
    title: '操作', key: 'actions', width: 130,
    render(row) {
      return h(NSpace, null, {
        default: () => [
          h(NButton, { size: 'small', quaternary: true, onClick: () => router.push(`/coupons/templates/${row.id}/edit`) }, { icon: () => h(NIcon, null, () => h(EditOutlined)) }),
          h(NButton, { size: 'small', quaternary: true, type: 'error', onClick: () => handleDelete(row.id!, row.name) }, { icon: () => h(NIcon, null, () => h(DeleteOutlined)) }),
        ]
      });
    }
  },
];

// ── Assign drawer ──
const assignOpen = ref(false);
const assignTemplateId = ref<number | null>(null);
const assignUserIds = ref<number[]>([]);
const assigning = ref(false);
const templateOptions = ref<{ label: string; value: number }[]>([]);
const userOptions = ref<{ label: string; value: number }[]>([]);

async function loadTemplates() {
  loading.value = true;
  const { data, error } = await fetchCouponTemplates();
  if (!error && data) templates.value = data;
  loading.value = false;
}

async function loadAssignData() {
  const [tRes, uRes] = await Promise.all([fetchCouponTemplates(), fetchUsers()]);
  if (!tRes.error && tRes.data) {
    templateOptions.value = tRes.data
      .filter((t: CouponTemplate) => t.isActive)
      .map((t: CouponTemplate) => ({ label: t.name, value: t.id! }));
  }
  if (!uRes.error && uRes.data) {
    const list = Array.isArray(uRes.data) ? uRes.data : uRes.data.list || [];
    userOptions.value = list.map((u: any) => ({ label: `${u.name || '用户' + u.id} (ID:${u.id})`, value: u.id }));
  }
}

function openAssignDrawer() {
  assignTemplateId.value = null;
  assignUserIds.value = [];
  assignOpen.value = true;
  loadAssignData();
}

async function handleAssign() {
  if (!assignTemplateId.value || assignUserIds.value.length === 0) {
    window.$message?.warning('请选择模板和用户');
    return;
  }
  assigning.value = true;
  const { error } = await fetchAssignCoupon(assignTemplateId.value, assignUserIds.value);
  assigning.value = false;
  if (!error) {
    window.$message?.success('优惠券已发放');
    assignOpen.value = false;
  }
}

async function handleToggle(id: number, val: boolean) {
  const { error } = await fetchToggleCouponTemplate(id);
  if (error) {
    window.$message?.error('切换状态失败');
    return;
  }
  window.$message?.success(val ? '已启用' : '已禁用');
}

async function handleDelete(id: number, name: string) {
  dialog.warning({
    title: '确认删除',
    content: `确定删除优惠券模板「${name}」？`,
    positiveText: '确认删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      const { error } = await fetchDeleteCouponTemplate(id);
      if (!error) {
        window.$message?.success('模板已删除');
        loadTemplates();
      }
    },
  });
}

onMounted(() => { loadTemplates(); });
</script>

<template>
  <NCard title="优惠券模板" :bordered="false" class="card-wrapper">
    <template #header-extra>
      <NSpace>
        <NButton type="primary" @click="router.push('/coupons/templates/create')">
          <template #icon><NIcon><PlusOutlined /></NIcon></template>
          新建模板
        </NButton>
        <NButton @click="openAssignDrawer">
          <template #icon><NIcon><SendOutlined /></NIcon></template>
          发放优惠券
        </NButton>
      </NSpace>
    </template>
    <NDataTable :columns="columns" :data="templates" :loading="loading" :row-key="(r: CouponTemplate) => r.id ?? 0" />

    <NDrawer v-model:show="assignOpen" width="480">
      <NDrawerContent title="发放优惠券" closable>
        <NForm label-placement="left" label-width="80">
          <NFormItem label="选择模板" required>
            <NSelect v-model:value="assignTemplateId" :options="templateOptions" placeholder="请选择优惠券模板" filterable />
          </NFormItem>
          <NFormItem label="选择用户" required>
            <NTransfer
              v-model:value="assignUserIds"
              :options="userOptions"
              :render-label="(option: any) => option.label"
            />
          </NFormItem>
        </NForm>
        <template #footer>
          <NSpace justify="end">
            <NButton @click="assignOpen = false">取消</NButton>
            <NButton type="primary" :loading="assigning" @click="handleAssign">确认发放</NButton>
          </NSpace>
        </template>
      </NDrawerContent>
    </NDrawer>
  </NCard>
</template>

<style scoped></style>
