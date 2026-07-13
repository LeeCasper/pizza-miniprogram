<script setup lang="ts">
import { ref, onMounted, h } from 'vue';
import { NCard, NDataTable, NButton, NTag, NSpace, NIcon, NModal, NForm, NFormItem, NInputNumber, NSelect, useMessage } from 'naive-ui';
import { EditOutlined } from '@vicons/antd';
import type { DataTableColumns } from 'naive-ui';
import { fetchMemberTiers, fetchUpdateMemberTier, type MemberTier } from '@/service/api';
import { formatPrice } from '@/utils/format';

defineOptions({ name: 'BirthdayBenefitsList' });

const message = useMessage();
const tiers = ref<MemberTier[]>([]);
const loading = ref(false);
const editModal = ref(false);
const saving = ref(false);

const editForm = ref({
  id: 0,
  name: '',
  birthdayCouponType: 'fixed_amount' as string,
  birthdayCouponValue: 0,
  birthdayCouponMinSpend: 0,
  birthdayCouponValidDays: 30,
});

const couponTypeOptions = [
  { label: '固定金额', value: 'fixed_amount' },
  { label: '折扣率(%)', value: 'percentage' },
];

const columns: DataTableColumns<MemberTier> = [
  { title: '等级', key: 'name', width: 120, render(row) { return h('strong', {}, row.name); } },
  {
    title: '券类型', key: 'birthdayCouponType', width: 100,
    render(row) { return row.birthdayCouponType === 'percentage' ? '折扣券' : '固定金额'; }
  },
  {
    title: '券面额', key: 'birthdayCouponValue', width: 100,
    render(row) {
      if (!row.birthdayCouponValue) return h('span', { style: { color: '#999' } }, '未设置');
      return row.birthdayCouponType === 'percentage'
        ? `${row.birthdayCouponValue}%`
        : formatPrice(row.birthdayCouponValue);
    }
  },
  {
    title: '最低消费', key: 'birthdayCouponMinSpend', width: 100,
    render(row) { return row.birthdayCouponMinSpend > 0 ? formatPrice(row.birthdayCouponMinSpend) : '无门槛'; }
  },
  {
    title: '有效期', key: 'birthdayCouponValidDays', width: 100,
    render(row) { return `${row.birthdayCouponValidDays || 30} 天`; }
  },
  {
    title: '操作', key: 'actions', width: 80,
    render(row) {
      return h(NButton, {
        size: 'small', quaternary: true, type: 'primary',
        onClick: () => openEdit(row),
      }, { icon: () => h(NIcon, null, () => h(EditOutlined)) });
    }
  },
];

function openEdit(row: MemberTier) {
  editForm.value = {
    id: row.id!,
    name: row.name,
    birthdayCouponType: row.birthdayCouponType || 'fixed_amount',
    birthdayCouponValue: row.birthdayCouponValue || 0,
    birthdayCouponMinSpend: row.birthdayCouponMinSpend || 0,
    birthdayCouponValidDays: row.birthdayCouponValidDays || 30,
  };
  editModal.value = true;
}

async function handleSave() {
  saving.value = true;
  const { error } = await fetchUpdateMemberTier(editForm.value.id, {
    birthday_coupon_type: editForm.value.birthdayCouponType,
    birthday_coupon_value: editForm.value.birthdayCouponValue,
    birthday_coupon_min_spend: editForm.value.birthdayCouponMinSpend,
    birthday_coupon_valid_days: editForm.value.birthdayCouponValidDays,
  });
  saving.value = false;
  if (!error) {
    message.success(`${editForm.value.name} 生日福利已保存`);
    editModal.value = false;
    loadTiers();
  } else {
    message.error('保存失败');
  }
}

async function loadTiers() {
  loading.value = true;
  const { data } = await fetchMemberTiers();
  if (data) tiers.value = data.filter(t => t.isActive);
  loading.value = false;
}

onMounted(() => { loadTiers(); });
</script>

<template>
  <NCard title="生日福利设置" :bordered="false" class="card-wrapper">
    <template #header-extra>
      <span style="color: #999; font-size: 13px">每天 8:00 系统自动为当天生日用户发放对应等级的生</span>
    </template>
    <NDataTable
      :columns="columns"
      :data="tiers"
      :loading="loading"
      :row-key="(r: MemberTier) => r.id ?? 0"
    />
  </NCard>

  <!-- 编辑弹窗 -->
  <NModal v-model:show="editModal" title="编辑生日福利" preset="card" style="width: 520px">
    <NForm label-placement="left" label-width="120">
      <NFormItem label="会员等级">
        <span style="font-weight: 600">{{ editForm.name }}</span>
      </NFormItem>
      <NFormItem label="券类型">
        <NSelect
          v-model:value="editForm.birthdayCouponType"
          :options="couponTypeOptions"
          style="width: 100%"
        />
      </NFormItem>
      <NFormItem :label="editForm.birthdayCouponType === 'percentage' ? '折扣率(%)' : '券面额(元)'">
        <NInputNumber
          v-model:value="editForm.birthdayCouponValue"
          :min="0"
          :step="editForm.birthdayCouponType === 'percentage' ? 1 : 0.01"
          :style="{ width: '100%' }"
          :placeholder="editForm.birthdayCouponType === 'percentage' ? '如 80 表示8折' : '如 20 表示20元'"
        />
      </NFormItem>
      <NFormItem label="最低消费(元)">
        <NInputNumber
          v-model:value="editForm.birthdayCouponMinSpend"
          :min="0" :step="0.01" :style="{ width: '100%' }"
          placeholder="0 表示无门槛"
        />
      </NFormItem>
      <NFormItem label="有效天数">
        <NInputNumber
          v-model:value="editForm.birthdayCouponValidDays"
          :min="1" :max="365" :style="{ width: '100%' }"
        />
      </NFormItem>
    </NForm>
    <template #footer>
      <NSpace justify="end">
        <NButton @click="editModal = false">取消</NButton>
        <NButton type="primary" :loading="saving" @click="handleSave">保存</NButton>
      </NSpace>
    </template>
  </NModal>
</template>

<style scoped></style>
