<script setup lang="ts">
import { ref } from 'vue';
import { NInput, NButton, NSpace, NTag } from 'naive-ui';

defineOptions({ name: 'TagArrayInput' });
const props = defineProps<{ placeholder?: string }>();
const model = defineModel<string[]>({ default: () => [] });
const input = ref('');

function add() {
  const val = input.value.trim();
  if (val && !model.value.includes(val)) {
    model.value = [...model.value, val];
    input.value = '';
  }
}
function remove(idx: number) {
  model.value = model.value.filter((_, i) => i !== idx);
}
</script>

<template>
  <div>
    <NSpace>
      <NInput v-model:value="input" :placeholder="props.placeholder || '输入后回车添加'" style="width:200px" @keyup.enter="add" />
      <NButton size="small" @click="add">添加</NButton>
    </NSpace>
    <NSpace v-if="model.length" style="margin-top:8px">
      <NTag v-for="(item, idx) in model" :key="idx" closable @close="remove(idx)">{{ item }}</NTag>
    </NSpace>
  </div>
</template>
