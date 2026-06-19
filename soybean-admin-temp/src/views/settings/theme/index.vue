<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import {
  NButton,
  NCard,
  NForm,
  NFormItem,
  NColorPicker,
  NSelect,
  NDivider,
  NGrid,
  NGridItem,
  NSpace,
  useMessage,
} from 'naive-ui';
import { fetchThemeSettings, fetchUpdateThemeSettings } from '@/service/api';

defineOptions({ name: 'SettingsTheme' });

const message = useMessage();
const loading = ref(false);
const saving = ref(false);

const form = ref({
  primaryColor: '#C583FF',
  secondaryColor: '#FFF292',
  tertiaryColor: '#A0FF92',
  accentColor: '#91F5FF',
  gradientColor1: '#E8D4FF',
  gradientColor2: '#D0FFCE',
  gradientColor3: '#FFF4B0',
  gradientColor4: '#C0F2FF',
  glassIntensity: 'medium' as 'low' | 'medium' | 'high',
});

const glassOptions = [
  { label: '低 - 轻微模糊', value: 'low' },
  { label: '中 - 标准毛玻璃（默认）', value: 'medium' },
  { label: '高 - 强烈毛玻璃', value: 'high' },
];

const glassMap: Record<string, { opacity: number; blur: string }> = {
  low: { opacity: 0.7, blur: '16px' },
  medium: { opacity: 0.5, blur: '28px' },
  high: { opacity: 0.35, blur: '40px' },
};

const previewGradient = computed(() => {
  const f = form.value;
  return `linear-gradient(135deg, ${f.gradientColor1} 0%, ${f.gradientColor2} 25%, ${f.gradientColor3} 50%, ${f.gradientColor4} 75%, ${f.gradientColor1} 100%)`;
});

const previewGlass = computed(() => {
  const g = glassMap[form.value.glassIntensity] || glassMap.medium;
  return {
    background: `rgba(255, 255, 255, ${g.opacity})`,
    backdropFilter: `saturate(200%) blur(${g.blur})`,
    WebkitBackdropFilter: `saturate(200%) blur(${g.blur})`,
  };
});

onMounted(async () => {
  loading.value = true;
  const { data, error } = await fetchThemeSettings();
  if (!error && data) {
    form.value.primaryColor = data.primaryColor || '#C583FF';
    form.value.secondaryColor = data.secondaryColor || '#FFF292';
    form.value.tertiaryColor = data.tertiaryColor || '#A0FF92';
    form.value.accentColor = data.accentColor || '#91F5FF';
    form.value.gradientColor1 = data.gradientColor1 || '#E8D4FF';
    form.value.gradientColor2 = data.gradientColor2 || '#D0FFCE';
    form.value.gradientColor3 = data.gradientColor3 || '#FFF4B0';
    form.value.gradientColor4 = data.gradientColor4 || '#C0F2FF';
    form.value.glassIntensity = data.glassIntensity || 'medium';
  }
  loading.value = false;
});

async function handleSave() {
  saving.value = true;
  const { error } = await fetchUpdateThemeSettings({ ...form.value });
  if (!error) {
    message.success('主题配置已保存，小程序下次启动时生效');
  } else {
    message.error('保存失败');
  }
  saving.value = false;
}
</script>

<template>
  <div style="display: flex; gap: 16px; align-items: flex-start">
    <!-- 左侧：配置表单 -->
    <NCard title="主题配置" :bordered="false" size="small" class="card-wrapper" style="flex: 1">
      <template #header-extra>
        <NButton type="primary" size="small" :loading="saving" @click="handleSave">
          保存
        </NButton>
      </template>

      <NForm label-width="120" label-placement="left">
        <NDivider title-placement="left" style="margin-top: 0">
          品牌色
        </NDivider>

        <NGrid :cols="2" :x-gap="24">
          <NGridItem>
            <NFormItem label="主色（按钮）">
              <NColorPicker v-model:value="form.primaryColor" :show-alpha="false" />
            </NFormItem>
          </NGridItem>
          <NGridItem>
            <NFormItem label="辅色（高亮）">
              <NColorPicker v-model:value="form.secondaryColor" :show-alpha="false" />
            </NFormItem>
          </NGridItem>
          <NGridItem>
            <NFormItem label="第三色（辅助）">
              <NColorPicker v-model:value="form.tertiaryColor" :show-alpha="false" />
            </NFormItem>
          </NGridItem>
          <NGridItem>
            <NFormItem label="强调色（信息）">
              <NColorPicker v-model:value="form.accentColor" :show-alpha="false" />
            </NFormItem>
          </NGridItem>
        </NGrid>

        <NDivider title-placement="left">
          背景渐变色
        </NDivider>

        <NGrid :cols="2" :x-gap="24">
          <NGridItem>
            <NFormItem label="渐变色 1">
              <NColorPicker v-model:value="form.gradientColor1" :show-alpha="false" />
            </NFormItem>
          </NGridItem>
          <NGridItem>
            <NFormItem label="渐变色 2">
              <NColorPicker v-model:value="form.gradientColor2" :show-alpha="false" />
            </NFormItem>
          </NGridItem>
          <NGridItem>
            <NFormItem label="渐变色 3">
              <NColorPicker v-model:value="form.gradientColor3" :show-alpha="false" />
            </NFormItem>
          </NGridItem>
          <NGridItem>
            <NFormItem label="渐变色 4">
              <NColorPicker v-model:value="form.gradientColor4" :show-alpha="false" />
            </NFormItem>
          </NGridItem>
        </NGrid>

        <NDivider title-placement="left">
          毛玻璃效果
        </NDivider>

        <NFormItem label="玻璃强度">
          <NSelect v-model:value="form.glassIntensity" :options="glassOptions" style="width: 100%" />
        </NFormItem>

        <NFormItem label="">
          <div style="color: #999; font-size: 12px; line-height: 1.8">
            <span>· 品牌色：控制小程序按钮、CTA、标签等元素的颜色。</span>
            <br />
            <span>· 背景渐变色：小程序页面底部的四色渐变效果，让毛玻璃可见。</span>
            <br />
            <span>· 毛玻璃强度：低 = 轻微模糊，中 = 标准效果，高 = 强烈磨砂。</span>
            <br />
            <span>· 保存后小程序下次冷启动时自动生效。</span>
          </div>
        </NFormItem>
      </NForm>
    </NCard>

    <!-- 右侧：实时预览 -->
    <NCard title="效果预览" :bordered="false" size="small" class="card-wrapper" style="width: 320px">
      <div
        :style="{
          background: previewGradient,
          borderRadius: '12px',
          padding: '20px',
          minHeight: '360px',
        }"
      >
        <!-- 模拟导航栏 -->
        <div
          :style="{
            ...previewGlass,
            borderRadius: '8px',
            padding: '10px 16px',
            marginBottom: '12px',
            border: '1px solid rgba(255,255,255,0.4)',
            color: '#1a1b2e',
            fontWeight: 600,
            fontSize: '14px',
          }"
        >
          王姐手工披萨
        </div>

        <!-- 模拟卡片 -->
        <div
          :style="{
            ...previewGlass,
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '12px',
            border: '1px solid rgba(255,255,255,0.4)',
          }"
        >
          <div style="font-size: 13px; color: #1a1b2e; font-weight: 600; margin-bottom: 8px">
            商品卡片
          </div>
          <div style="font-size: 12px; color: #5b4d6e; margin-bottom: 12px">
            经典意式手工披萨
          </div>
          <NSpace>
            <div
              :style="{
                background: form.primaryColor,
                color: '#fff',
                borderRadius: '20px',
                padding: '4px 16px',
                fontSize: '12px',
                fontWeight: 600,
              }"
            >
              立即购买
            </div>
            <div
              :style="{
                background: form.secondaryColor,
                color: '#3e2d00',
                borderRadius: '20px',
                padding: '4px 16px',
                fontSize: '12px',
                fontWeight: 600,
              }"
            >
              ¥39.9
            </div>
          </NSpace>
        </div>

        <!-- 模拟标签组 -->
        <NSpace style="margin-bottom: 12px">
          <div
            :style="{
              background: form.tertiaryColor,
              color: '#1b5e20',
              borderRadius: '12px',
              padding: '3px 10px',
              fontSize: '11px',
              fontWeight: 600,
            }"
          >
            新品
          </div>
          <div
            :style="{
              background: form.accentColor,
              color: '#0d47a1',
              borderRadius: '12px',
              padding: '3px 10px',
              fontSize: '11px',
              fontWeight: 600,
            }"
          >
            推荐
          </div>
        </NSpace>

        <!-- 模拟底部按钮 -->
        <div
          :style="{
            ...previewGlass,
            borderRadius: '8px',
            padding: '10px',
            border: '1px solid rgba(255,255,255,0.4)',
            textAlign: 'center',
            fontSize: '12px',
            color: '#5b4d6e',
          }"
        >
          底部导航栏
        </div>
      </div>
    </NCard>
  </div>
</template>
