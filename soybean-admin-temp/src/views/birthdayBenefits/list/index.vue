<script setup lang="ts">
import { ref, onMounted, h } from 'vue';
import { NCard, NDataTable, NButton, NIcon, NModal, NForm, NFormItem, NInputNumber, NSelect, NDivider, NSpace, useMessage } from 'naive-ui';
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
  // 无门槛券
  c1Type: 'fixed_amount' as string,
  c1Value: 0,
  c1ValidDays: 30,
  // 满减券
  c2Type: 'fixed_amount' as string,
  c2Value: 0,
  c2MinSpend: 50,
  c2ValidDays: 30,
});

const couponTypeOptions = [
  { label: '固定金额', value: 'fixed_amount' },
  { label: '折扣率(%)', value: 'percentage' },
];

const columns: DataTableColumns<MemberTier> = [
  { title: '等级', key: 'name', width: 100, render(row) { return h('strong', {}, row.name); } },
  {
    title: '无门槛券', key: 'birthdayCouponValue', width: 110,
    render(row) {
      if (!row.birthdayCouponValue) return h('span', { style: { color: '#ccc' } }, '—');
      const v = row.birthdayCouponType === 'percentage' ? `${row.birthdayCouponValue}%` : formatPrice(row.birthdayCouponValue);
      return `${v} / ${row.birthdayCouponValidDays || 30}天`;
    }
  },
  {
    title: '满减券', key: 'birthdayCoupon2Value', width: 140,
    render(row) {
      if (!row.birthdayCoupon2Value) return h('span', { style: { color: '#ccc' } }, '—');
      const v = row.birthdayCoupon2Type === 'percentage' ? `${row.birthdayCoupon2Value}%` : formatPrice(row.birthdayCoupon2Value);
      const ms = row.birthdayCoupon2MinSpend > 0 ? `满${formatPrice(row.birthdayCoupon2MinSpend)}` : '';
      return `${v} ${ms} / ${row.birthdayCoupon2ValidDays || 30}天`;
    }
  },
  {
    title: '操作', key: 'actions', width: 80,
    render(row) {
      return h(NButton, { size: 'small', quaternary: true, type: 'primary', onClick: () => openEdit(row) },
        { icon: () => h(NIcon, null, () => h(EditOutlined)) });
    }
  },
];

function openEdit(row: MemberTier) {
  editForm.value = {
    id: row.id!,
    name: row.name,
    c1Type: row.birthdayCouponType || 'fixed_amount',
    c1Value: row.birthdayCouponValue || 0,
    c1ValidDays: row.birthdayCouponValidDays || 30,
    c2Type: row.birthdayCoupon2Type || 'fixed_amount',
    c2Value: row.birthdayCoupon2Value || 0,
    c2MinSpend: row.birthdayCoupon2MinSpend || 0,
    c2ValidDays: row.birthdayCoupon2ValidDays || 30,
  };
  editModal.value = true;
}

async function handleSave() {
  saving.value = true;
  const { error } = await fetchUpdateMemberTier(editForm.value.id, {
    birthday_coupon_type: editForm.value.c1Type,
    birthday_coupon_value: editForm.value.c1Value,
    birthday_coupon_min_spend: 0, // 无门槛
    birthday_coupon_valid_days: editForm.value.c1ValidDays,
    birthday_coupon2_type: editForm.value.c2Type,
    birthday_coupon2_value: editForm.value.c2Value,
    birthday_coupon2_min_spend: editForm.value.c2MinSpend,
    birthday_coupon2_valid_days: editForm.value.c2ValidDays,
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
      <span style="color: #999; font-size: 13px">生日当天 8:00 自动发放两张券（不可叠加使用）</span>
    </template>
    <NDataTable :columns="columns" :data="tiers" :loading="loading" :row-key="(r: MemberTier) => r.id ?? 0" />
  </NCard>

  <NModal v-model:show="editModal" title="编辑生日福利" preset="card" style="width: 560px">
    <NForm label-placement="left" label-width="110">
      <NFormItem label="会员等级">
        <span style="font-weight: 600">{{ editForm.name }}</span>
      </NFormItem>

      <NDivider title-placement="left"><strong>🎁 无门槛券</strong></NDivider>

      <NFormItem label="券类型">
        <NSelect v-model:value="editForm.c1Type" :options="couponTypeOptions" style="width: 100%" />
      </NFormItem>
      <NFormItem :label="editForm.c1Type === 'percentage' ? '折扣率(%)' : '券面额(元)'">
        <NInputNumber v-model:value="editForm.c1Value" :min="0" :step="editForm.c1Type === 'percentage' ? 1 : 0.01" :style="{ width: '100%' }" />
      </NFormItem>
      <NFormItem label="有效天数">
        <NInputNumber v-model:value="editForm.c1ValidDays" :min="1" :max="365" :style="{ width: '100%' }" />
      </NFormItem>

      <NDivider title-placement="left"><strong>🏷️ 满减券</strong>（需满足最低消费）</NDivider>

      <NFormItem label="券类型">
        <NSelect v-model:value="editForm.c2Type" :options="couponTypeOptions" style="width: 100%" />
      </NFormItem>
      <NFormItem :label="editForm.c2Type === 'percentage' ? '折扣率(%)' : '券面额(元)'">
        <NInputNumber v-model:value="editForm.c2Value" :min="0" :step="editForm.c2Type === 'percentage' ? 1 : 0.01" :style="{ width: '100%' }" />
      </NFormItem>
      <NFormItem label="最低消费(元)">
        <NInputNumber v-model:value="editForm.c2MinSpend" :min="0" :step="0.01" :style="{ width: '100%' }" placeholder="满多少元可用" />
      </NFormItem>
      <NFormItem label="有效天数">
        <NInputNumber v-model:value="editForm.c2ValidDays" :min="1" :max="365" :style="{ width: '100%' }" />
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
