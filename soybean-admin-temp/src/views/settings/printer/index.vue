<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import {
  NButton,
  NSpace,
  NCard,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NSwitch,
  NAlert,
  NModal,
  NGrid,
  NGi,
  useMessage,
} from 'naive-ui';
import {
  fetchPrinterSettings,
  fetchUpdatePrinterSettings,
  fetchTestPrinter,
  fetchPrinterPreview,
} from '@/service/api';

defineOptions({ name: 'SettingsPrinter' });

const message = useMessage();
const loading = ref(false);
const saving = ref(false);
const testing = ref(false);
const previewing = ref(false);
const showPreview = ref(false);
const previewText = ref('');

const form = ref({
  enabled: false,
  appId: '',
  appSecret: '',
  sn: '',
  pkey: '',
  apiBase: 'https://open.spyun.net',
  copies: 1,
  // 小票模板
  storeName: '王姐手工披萨',
  footerText: '感谢您的光临！',
  footerTip: '请到取餐口出示取餐码',
  audioEnabled: true,
});

const appSecretModified = ref(false);
const pkeyModified = ref(false);

onMounted(async () => {
  loading.value = true;
  const { data, error } = await fetchPrinterSettings();
  if (!error && data) {
    form.value.enabled = data.enabled || false;
    form.value.appId = data.appId || '';
    form.value.appSecret = data.appSecret || '';
    form.value.sn = data.sn || '';
    form.value.pkey = data.pkey || '';
    form.value.apiBase = data.apiBase || 'https://open.spyun.net';
    form.value.copies = data.copies || 1;
    // 模板字段 — 空值使用默认
    form.value.storeName = data.storeName || '王姐手工披萨';
    form.value.footerText = data.footerText || '感谢您的光临！';
    form.value.footerTip = data.footerTip || '请到取餐口出示取餐码';
    form.value.audioEnabled = data.audioEnabled !== false;
  }
  loading.value = false;
});

function onAppSecretInput() {
  appSecretModified.value = true;
}

function onPkeyInput() {
  pkeyModified.value = true;
}

async function handleSave() {
  saving.value = true;
  const payload: Record<string, any> = {
    enabled: form.value.enabled,
    appId: form.value.appId,
    sn: form.value.sn,
    apiBase: form.value.apiBase,
    copies: form.value.copies,
    // 小票模板
    storeName: form.value.storeName,
    footerText: form.value.footerText,
    footerTip: form.value.footerTip,
    audioEnabled: form.value.audioEnabled,
  };

  if (appSecretModified.value) {
    payload.appSecret = form.value.appSecret;
  }

  if (pkeyModified.value) {
    payload.pkey = form.value.pkey;
  }

  const { error } = await fetchUpdatePrinterSettings(payload);
  if (!error) {
    message.success('打印机配置已保存');
    appSecretModified.value = false;
  } else {
    message.error('保存失败');
  }
  saving.value = false;
}

async function handleTestPrint() {
  testing.value = true;
  const { error } = await fetchTestPrinter();
  if (!error) {
    message.success('测试打印已发送，请检查打印机');
  } else {
    message.error('测试打印失败');
  }
  testing.value = false;
}

async function handlePreview() {
  previewing.value = true;
  const { data, error } = await fetchPrinterPreview();
  if (!error && data) {
    previewText.value = data.plain;
    showPreview.value = true;
  } else {
    message.error('获取预览失败');
  }
  previewing.value = false;
}

// ── 实时预览（客户端生成，随表单输入变化）──────────
const livePreview = computed(() => {
  const f = form.value;
  const storeName = f.storeName || '王姐手工披萨';
  const footerText = f.footerText || '感谢您的光临！';
  const footerTip = f.footerTip || '请到取餐口出示取餐码';
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

  const lines = [
    storeName,
    '——————————————',
    '取餐码',
    'A001',
    '——————————————',
    '',
    '订单号：20260617001',
    `下单时间：${ts}`,
    '支付方式：微信支付',
    '备注：少辣',
    '',
    '——————————————',
    '商品名称        数量  金额',
    '——————————————',
    '夏威夷披萨        x1  ￥58.00',
    '  └ 忌口: 不吃辣, 花生过敏',
    '榴莲饼            x2  ￥56.00',
    '  └ 忌口: 素食',
    '——————————————',
    '商品合计：￥114.00',
    '优惠减免：-￥24.00',
    '实付：￥90.00',
    '',
    '——————————————',
    footerText,
    footerTip,
  ];

  if (f.audioEnabled) {
    lines.push('', '🔊 语音播报');
  }

  return lines.join('\n');
});
</script>

<template>
  <NGrid :cols="2" :x-gap="16" :y-gap="16" responsive="screen" item-responsive>
    <!-- 左侧：配置区域 -->
    <NGi span="2 m:1">
      <NSpace vertical size="large">
        <!-- 打印机连接配置 -->
        <NCard title="打印机配置" :bordered="false" size="small" class="card-wrapper">
          <template #header-extra>
            <NButton type="primary" size="small" :loading="saving" @click="handleSave">
              保存
            </NButton>
          </template>

          <NAlert
            v-if="!form.enabled"
            type="warning"
            title="打印机未启用"
            style="margin-bottom: 24px"
          >
            请开启下方开关并填写打印机信息后保存。
            打印机支持商鹏云打印（open.spyun.net），使用前请先在商鹏开放平台获取 appId 和 appSecret。
          </NAlert>

          <NForm label-width="120" label-placement="left">
            <NFormItem label="启用打印机">
              <NSwitch v-model:value="form.enabled" />
            </NFormItem>

            <NFormItem label="API 地址">
              <NInput v-model:value="form.apiBase" placeholder="https://open.spyun.net" />
            </NFormItem>

            <NFormItem label="App ID">
              <NInput v-model:value="form.appId" placeholder="商鹏开放平台获取" />
            </NFormItem>

            <NFormItem label="App Secret">
              <NInput
                v-model:value="form.appSecret"
                type="password"
                show-password-on="click"
                placeholder="商鹏开放平台获取"
                @input="onAppSecretInput"
              />
            </NFormItem>

            <NFormItem label="打印机 SN">
              <NInput v-model:value="form.sn" placeholder="打印机底部标签上的序列号" />
            </NFormItem>

            <NFormItem label="设备 KEY">
              <NInput
                v-model:value="form.pkey"
                type="password"
                show-password-on="click"
                placeholder="打印机底部标签上的 KEY"
                @input="onPkeyInput"
              />
            </NFormItem>

            <NFormItem label="打印份数">
              <NInputNumber v-model:value="form.copies" :min="1" :max="5" />
            </NFormItem>
          </NForm>
        </NCard>

        <!-- 小票内容设置 -->
        <NCard title="小票内容设置" :bordered="false" size="small" class="card-wrapper">
          <NForm label-width="120" label-placement="left">
            <NFormItem label="店铺名称">
              <NInput v-model:value="form.storeName" placeholder="王姐手工披萨" />
            </NFormItem>

            <NFormItem label="页脚文字">
              <NInput v-model:value="form.footerText" placeholder="感谢您的光临！" />
            </NFormItem>

            <NFormItem label="取餐提示">
              <NInput v-model:value="form.footerTip" placeholder="请到取餐口出示取餐码" />
            </NFormItem>

            <NFormItem label="语音播报">
              <NSwitch v-model:value="form.audioEnabled" />
            </NFormItem>
          </NForm>
        </NCard>

        <!-- 测试与预览 -->
        <NCard title="测试与预览" :bordered="false" size="small" class="card-wrapper">
          <p style="color: var(--n-text-color-2); margin-bottom: 16px">
            发送测试小票到打印机，或查看服务端生成的打印内容。
          </p>
          <NSpace>
            <NButton type="primary" :loading="testing" @click="handleTestPrint" :disabled="!form.sn">
              发送测试打印
            </NButton>
            <NButton :loading="previewing" @click="handlePreview">
              服务端预览
            </NButton>
          </NSpace>
        </NCard>
      </NSpace>
    </NGi>

    <!-- 右侧：实时预览 -->
    <NGi span="2 m:1">
      <NCard title="小票预览" :bordered="false" size="small" class="card-wrapper">
        <template #header-extra>
          <span style="color: var(--n-text-color-3); font-size: 12px">随左侧设置实时更新</span>
        </template>
        <div class="receipt-preview-wrapper">
          <pre class="receipt-preview">{{ livePreview }}</pre>
        </div>
      </NCard>
    </NGi>
  </NGrid>

  <NModal v-model:show="showPreview" title="服务端打印内容预览" style="max-width: 420px">
    <pre style="
      background: #f5f5f5;
      padding: 20px;
      border-radius: 8px;
      font-size: 14px;
      line-height: 1.6;
      white-space: pre-wrap;
      font-family: 'Courier New', monospace;
      max-height: 500px;
      overflow-y: auto;
      margin: 0;
    ">{{ previewText }}</pre>
  </NModal>
</template>

<style scoped>
.receipt-preview-wrapper {
  display: flex;
  justify-content: center;
  padding: 16px;
  background: #f8f8f8;
  border-radius: 8px;
}

.receipt-preview {
  width: 300px;
  background: #fff;
  padding: 24px 16px;
  border-radius: 4px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  font-family: 'Courier New', 'SimSun', monospace;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
  text-align: center;
}
</style>
