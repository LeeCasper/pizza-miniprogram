<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { NButton, NSpace, NCard, NForm, NFormItem, NInput, NInputNumber, NSpin } from 'naive-ui';
import { fetchMemberTier, fetchCreateMemberTier, fetchUpdateMemberTier, type MemberTier } from '@/service/api';

defineOptions({ name: 'MemberTiersForm' });

const router = useRouter();
const route = useRoute();
const isEdit = ref(false);
const saving = ref(false);
const loading = ref(false);

const form = ref<Partial<MemberTier>>({
  levelKey: '',
  name: '',
  levelIndex: 1,
  minSpent: 0,
  discountRate: 1.00,
  pointsRewardRate: 1.00,
  birthdayGift: '',
  couponValue: 0,
});

onMounted(async () => {
  const id = route.params.id as string;
  if (id && id !== 'create') {
    isEdit.value = true;
    loading.value = true;
    const { data, error } = await fetchMemberTier(Number(id));
    if (!error && data) {
      form.value = {
        levelKey: data.levelKey,
        name: data.name,
        levelIndex: data.levelIndex,
        minSpent: data.minSpent,
        discountRate: data.discountRate,
        pointsRewardRate: data.pointsRewardRate,
        birthdayGift: data.birthdayGift,
        couponValue: data.couponValue,
      };
    }
    loading.value = false;
  }
});

async function handleSave() {
  saving.value = true;
  const id = route.params.id as string;
  const payload = { ...form.value };

  let error: any;
  if (isEdit.value) {
    const res = await fetchUpdateMemberTier(Number(id), payload);
    error = res.error;
  } else {
    const res = await fetchCreateMemberTier(payload);
    error = res.error;
  }

  saving.value = false;
  if (!error) {
    window.$message?.success(isEdit.value ? '等级已更新' : '等级已创建');
    router.push('/member-tiers/list');
  } else {
    window.$message?.error(error?.message || '保存失败');
  }
}
</script>

<template>
  <NCard :title="isEdit ? '编辑等级' : '新建等级'" :bordered="false" class="card-wrapper">
    <template #header-extra>
      <NSpace>
        <NButton @click="router.push('/member-tiers/list')">返回</NButton>
        <NButton type="primary" :loading="saving" @click="handleSave">保存</NButton>
      </NSpace>
    </template>

    <NSpin :show="loading">
      <NForm label-placement="left" label-width="140" :style="{ maxWidth: '600px' }">
        <NFormItem label="等级标识" required>
          <NInput v-model:value="form.levelKey" placeholder="如 silver, gold, rose_gold" />
        </NFormItem>
        <NFormItem label="等级名称" required>
          <NInput v-model:value="form.name" placeholder="如 银卡会员" />
        </NFormItem>
        <NFormItem label="等级序号" required>
          <NInputNumber v-model:value="form.levelIndex" :min="1" :style="{ width: '100%' }" />
        </NFormItem>
        <NFormItem label="最低消费(元)" required>
          <NInputNumber v-model:value="form.minSpent" :min="0" :step="0.01" :style="{ width: '100%' }" />
        </NFormItem>
        <NFormItem label="折扣率">
          <NInputNumber v-model:value="form.discountRate" :min="0" :max="1" :step="0.01" :style="{ width: '100%' }" placeholder="0.95 = 95折, 1.00 = 原价" />
        </NFormItem>
        <NFormItem label="积分倍率">
          <NInputNumber v-model:value="form.pointsRewardRate" :min="1" :step="0.1" :style="{ width: '100%' }" placeholder="1.0 = 1元1分" />
        </NFormItem>
        <NFormItem label="生日礼物">
          <NInput v-model:value="form.birthdayGift" placeholder="生日当月享X折优惠" />
        </NFormItem>
        <NFormItem label="升级奖券(元)">
          <NInputNumber v-model:value="form.couponValue" :min="0" :step="0.01" :style="{ width: '100%' }" />
        </NFormItem>
      </NForm>
    </NSpin>
  </NCard>
</template>

<style scoped></style>
