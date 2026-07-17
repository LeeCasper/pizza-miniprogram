# 联系客服功能 — 微信官方客服消息

## 概述

将当前 3 处硬编码假客服入口（Toast 显示假电话号码）全部替换为微信官方 `<button open-type="contact">`，用户点击后进入微信原生客服会话页面。同时在设置页新增客服入口。

无需后端改动。

## 入口清单

| # | 页面 | 文件 | 当前行为 | 改为 |
|---|------|------|---------|------|
| 1 | 个人中心（独立页） | `pages/profile/profile.wxml:175` | Toast 假号码 | `<button open-type="contact">` |
| 2 | 个人中心（main 内嵌） | `pages/main/tpl-profile.wxml:188` | Toast 假号码 | 同上 |
| 3 | 商城详情底部栏 | `pages/shop-detail/shop-detail.wxml:183` | Toast "请联系客服" | 同上 |
| 4 | 设置页 | `pages/settings/settings.wxml` | **无** | 新增菜单项 |

## 技术方案

### 核心组件

```html
<button
  open-type="contact"
  session-from="{"userId":"{{userId}}","phone":"{{phoneNumber}}","page":"<来源页>"}"
  show-message-card="{{true}}"
  send-message-title="王姐手工披萨 · 在线客服"
  send-message-path="/pages/main/main"
  bindcontact="onContactCallback"
  class="contact-btn-reset"
>
  <!-- 保持原有视觉样式不变 -->
</button>
```

### 属性说明

| 属性 | 值 | 说明 |
|------|----|------|
| `open-type` | `contact` | 微信原生客服消息 |
| `session-from` | JSON 字符串 | 客服端可见：userId、phone、来源页面 |
| `show-message-card` | true | 允许用户发送小程序卡片给客服 |
| `send-message-title` | 固定文案 | 消息卡片标题 |
| `send-message-path` | `/pages/main/main` | 点击消息卡片跳转路径 |

### CSS 关键点

`<button>` 默认有边框、背景、padding 等样式。必须用 `.contact-btn-reset` 重置：

```css
.contact-btn-reset {
  border: none;
  background: transparent;
  padding: 0;
  margin: 0;
  line-height: inherit;
  font-size: inherit;
  color: inherit;
  text-align: inherit;
  border-radius: 0;
}
.contact-btn-reset::after {
  display: none;  /* 去掉微信 button 的默认伪元素边框 */
}
```

按钮内部放置原有的 icon + label 结构，视觉上与现有 grid-item 完全一致。

### JS 改动

1. **`profile.js`** — 删除 `'service': '__toast__'` 映射和 toast 分支（如果 `service` 是该分支的唯一使用）。
2. **`main.js`** — 同上，删除 `service: '__toast__'`。
3. **`shop-detail.js`** — `onContactService()` 方法可删除（button open-type 不需要 JS handler），保留空方法或直接去掉 `bindtap`。

### 前提条件（无需代码改动）

- 小程序后台已开通**客服消息**功能（微信公众平台 → 开发 → 开发管理 → 客服消息）
- 已添加至少 1 名客服人员
- 客服人员使用**微信客服**网页版或手机端接收消息

## 文件改动

| 操作 | 文件 |
|------|------|
| 修改 | `miniprogram/pages/profile/profile.wxml` |
| 修改 | `miniprogram/pages/profile/profile.wxss` |
| 修改 | `miniprogram/pages/profile/profile.js` |
| 修改 | `miniprogram/pages/main/tpl-profile.wxml` |
| 修改 | `miniprogram/pages/main/main.wxss` |
| 修改 | `miniprogram/pages/main/main.js` |
| 修改 | `miniprogram/pages/shop-detail/shop-detail.wxml` |
| 修改 | `miniprogram/pages/shop-detail/shop-detail.wxss` |
| 修改 | `miniprogram/pages/shop-detail/shop-detail.js` |
| 修改 | `miniprogram/pages/settings/settings.wxml` |
| 修改 | `miniprogram/pages/settings/settings.wxss` |
| 修改 | `miniprogram/pages/settings/settings.js` |
| 新增 | `miniprogram/images/icon-setting-service.png`（设置页图标） |

## 不在范围内

- 后端客服消息 API（接收/发送消息、自动回复）— 微信官方客服平台已覆盖
- 智能客服/机器人 — 需额外对接第三方
