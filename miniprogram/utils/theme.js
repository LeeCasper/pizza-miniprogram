/**
 * 动态主题模块
 *
 * 从后台管理 API 加载主题配置，计算派生 CSS 变量，生成 inline style 字符串。
 * app.wxss 中的静态变量作为 fallback；本模块生成的 inline style 覆盖它们。
 *
 * 使用方式:
 *   const { getThemeStyle, getThemeColor, loadThemeConfig, buildThemeStyle } = require('./theme');
 *
 *   // 页面 data 中:
 *   data: { themeStyle: getThemeStyle() }
 *
 *   // WXML 根元素:
 *   <view style="{{themeStyle}} padding-top: {{topBarTotalHeight}}px">
 *
 *   // JS 中获取单个颜色:
 *   confirmColor: getThemeColor('primary')
 */

const { api } = require('./api');

// ── 缓存 ────────────────────────────────────────────────
let _themeConfig = null;
let _themePromise = null;
let _themeStyle = '';

// ── 默认值（与 pizza-server config/index.js 同步） ──────
const DEFAULTS = {
  primaryColor: '#C583FF',
  secondaryColor: '#FFF292',
  tertiaryColor: '#A0FF92',
  accentColor: '#91F5FF',
  gradientColor1: '#E8D4FF',
  gradientColor2: '#D0FFCE',
  gradientColor3: '#FFF4B0',
  gradientColor4: '#C0F2FF',
  glassIntensity: 'medium',
};

// ── 颜色工具函数 ─────────────────────────────────────────

/** #RRGGBB → { r, g, b } */
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

/** { r, g, b } → #RRGGBB */
function rgbToHex(r, g, b) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return '#' + c(r) + c(g) + c(b);
}

/** RGB → HSL (h: 0-360, s: 0-1, l: 0-1) */
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return { h: h * 360, s, l };
}

/** HSL → RGB */
function hslToRgb(h, s, l) {
  h /= 360;
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

/** 调亮颜色 (amount: 0-1) */
function lighten(hex, amount) {
  const rgb = hexToRgb(hex);
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  hsl.l = Math.min(1, hsl.l + amount);
  const result = hslToRgb(hsl.h, hsl.s, hsl.l);
  return rgbToHex(result.r, result.g, result.b);
}

/** 调暗颜色 (amount: 0-1) */
function darken(hex, amount) {
  const rgb = hexToRgb(hex);
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  hsl.l = Math.max(0, hsl.l - amount);
  const result = hslToRgb(hsl.h, hsl.s, hsl.l);
  return rgbToHex(result.r, result.g, result.b);
}

// ── 毛玻璃强度预设 ───────────────────────────────────────

const GLASS_PRESETS = {
  low: {
    cardOpacity: 0.70, elevatedOpacity: 0.80, lightOpacity: 0.50, navOpacity: 0.75,
    blurSm: '12px', blur: '16px', blurLg: '24px',
    borderOpacity: 0.20, borderSubtleOpacity: 0.15,
  },
  medium: {
    cardOpacity: 0.50, elevatedOpacity: 0.62, lightOpacity: 0.30, navOpacity: 0.60,
    blurSm: '16px', blur: '28px', blurLg: '40px',
    borderOpacity: 0.55, borderSubtleOpacity: 0.30,
  },
  high: {
    cardOpacity: 0.35, elevatedOpacity: 0.45, lightOpacity: 0.20, navOpacity: 0.40,
    blurSm: '24px', blur: '40px', blurLg: '56px',
    borderOpacity: 0.70, borderSubtleOpacity: 0.45,
  },
};

// ── 核心函数 ─────────────────────────────────────────────

/**
 * 从 API 加载主题配置（带缓存，仅请求一次）
 * @returns {Promise<object>} 主题配置
 */
function loadThemeConfig() {
  if (_themeConfig) return Promise.resolve(_themeConfig);
  if (_themePromise) return _themePromise;

  _themePromise = api.get('/config/theme').then(res => {
    if (res.code === 0 && res.data) {
      // 合并 API 数据与默认值
      _themeConfig = {};
      Object.keys(DEFAULTS).forEach(key => {
        _themeConfig[key] = res.data[key] || DEFAULTS[key];
      });
    } else {
      _themeConfig = { ...DEFAULTS };
    }
    // 预构建样式字符串
    _themeStyle = buildThemeStyle(_themeConfig);
    _themePromise = null;
    return _themeConfig;
  }).catch(() => {
    _themeConfig = { ...DEFAULTS };
    _themeStyle = '';  // 使用 app.wxss 默认值
    _themePromise = null;
    return _themeConfig;
  });

  return _themePromise;
}

/**
 * 从 9 个基础参数构建 CSS 变量 inline style 字符串
 * @param {object} cfg - 主题配置
 * @returns {string} CSS 变量声明字符串
 */
function buildThemeStyle(cfg) {
  if (!cfg) return '';

  const p = hexToRgb(cfg.primaryColor);
  const s = hexToRgb(cfg.secondaryColor);
  const glass = GLASS_PRESETS[cfg.glassIntensity] || GLASS_PRESETS.medium;

  // 从主色派生颜色
  const primaryDark = darken(cfg.primaryColor, 0.20);
  const primaryLight = lighten(cfg.primaryColor, 0.25);
  const primaryContainer = lighten(cfg.primaryColor, 0.35);
  const onPrimaryContainer = darken(cfg.primaryColor, 0.45);

  // 从辅色派生
  const secondaryDark = darken(cfg.secondaryColor, 0.35);
  const secondaryContainer = lighten(cfg.secondaryColor, 0.15);
  const onSecondary = darken(cfg.secondaryColor, 0.60);
  const onSecondaryContainer = darken(cfg.secondaryColor, 0.50);

  // 从第三色派生
  const tertiaryContainer = lighten(cfg.tertiaryColor, 0.15);
  const onTertiary = darken(cfg.tertiaryColor, 0.55);

  // 从主色派生 surface 色（极淡的主色调底）
  const surfaceBright = lighten(cfg.primaryColor, 0.42);
  const surfaceContainer = lighten(cfg.primaryColor, 0.38);
  const surfaceContainerLow = lighten(cfg.primaryColor, 0.40);
  const surfaceContainerHigh = lighten(cfg.primaryColor, 0.35);
  const surfaceContainerHighest = lighten(cfg.primaryColor, 0.32);
  const surfaceDim = lighten(cfg.primaryColor, 0.28);
  const outline = lighten(cfg.primaryColor, 0.12);
  const outlineVariant = lighten(cfg.primaryColor, 0.30);
  const divider = lighten(cfg.primaryColor, 0.36);

  // 玻璃背景色 — 融入主色调而非纯白
  const navTint = lighten(cfg.primaryColor, 0.08);
  const navRgb = hexToRgb(navTint);
  const elevatedTint = lighten(cfg.primaryColor, 0.15);
  const elevRgb = hexToRgb(elevatedTint);
  const cardTint = lighten(cfg.primaryColor, 0.22);
  const cardRgb = hexToRgb(cardTint);

  const vars = [
    // 品牌色
    '--color-primary: ' + cfg.primaryColor,
    '--color-primary-dark: ' + primaryDark,
    '--color-primary-light: ' + primaryLight,
    '--color-primary-container: ' + primaryContainer,
    '--color-on-primary-container: ' + onPrimaryContainer,

    '--color-secondary: ' + cfg.secondaryColor,
    '--color-secondary-dark: ' + secondaryDark,
    '--color-secondary-container: ' + secondaryContainer,
    '--color-on-secondary: ' + onSecondary,
    '--color-on-secondary-container: ' + onSecondaryContainer,

    '--color-tertiary: ' + cfg.tertiaryColor,
    '--color-tertiary-container: ' + tertiaryContainer,
    '--color-on-tertiary: ' + onTertiary,

    // 表面色（从主色派生）
    '--color-background: ' + surfaceBright,
    '--color-surface: ' + surfaceBright,
    '--color-surface-bright: ' + surfaceBright,
    '--color-surface-container: ' + surfaceContainer,
    '--color-surface-container-low: ' + surfaceContainerLow,
    '--color-surface-container-high: ' + surfaceContainerHigh,
    '--color-surface-container-highest: ' + surfaceContainerHighest,
    '--color-surface-dim: ' + surfaceDim,

    // 描边 / 分割
    '--color-outline: ' + outline,
    '--color-outline-variant: ' + outlineVariant,
    '--color-divider: ' + divider,

    // 渐变色
    '--gradient-1: ' + cfg.gradientColor1,
    '--gradient-2: ' + cfg.gradientColor2,
    '--gradient-3: ' + cfg.gradientColor3,
    '--gradient-4: ' + cfg.gradientColor4,

    // 毛玻璃 — 背景（融入主色调，不再纯白）
    '--glass-bg-card: rgba(' + cardRgb.r + ', ' + cardRgb.g + ', ' + cardRgb.b + ', ' + glass.cardOpacity + ')',
    '--glass-bg-elevated: rgba(' + elevRgb.r + ', ' + elevRgb.g + ', ' + elevRgb.b + ', ' + glass.elevatedOpacity + ')',
    '--glass-bg-light: rgba(' + elevRgb.r + ', ' + elevRgb.g + ', ' + elevRgb.b + ', ' + glass.lightOpacity + ')',
    '--glass-bg-nav: rgba(' + navRgb.r + ', ' + navRgb.g + ', ' + navRgb.b + ', ' + glass.navOpacity + ')',
    '--glass-bg-primary: rgba(' + p.r + ', ' + p.g + ', ' + p.b + ', 0.82)',
    '--glass-bg-primary-light: rgba(' + p.r + ', ' + p.g + ', ' + p.b + ', 0.10)',
    '--glass-bg-primary-container: rgba(' + hexToRgb(primaryContainer).r + ', ' + hexToRgb(primaryContainer).g + ', ' + hexToRgb(primaryContainer).b + ', 0.65)',

    // 毛玻璃 — 模糊
    '--glass-blur-sm: saturate(200%) blur(' + glass.blurSm + ')',
    '--glass-blur: saturate(200%) blur(' + glass.blur + ')',
    '--glass-blur-lg: saturate(200%) blur(' + glass.blurLg + ')',

    // 毛玻璃 — 边框
    '--glass-border: 2rpx solid rgba(255, 255, 255, ' + glass.borderOpacity + ')',
    '--glass-border-subtle: 1rpx solid rgba(255, 255, 255, ' + glass.borderSubtleOpacity + ')',
    '--glass-border-colored: 2rpx solid rgba(' + p.r + ', ' + p.g + ', ' + p.b + ', 0.25)',

    // 阴影（使用主色 RGB）
    '--shadow-xs: 0 1rpx 4rpx rgba(' + p.r + ', ' + p.g + ', ' + p.b + ', 0.05)',
    '--shadow-sm: 0 2rpx 8rpx rgba(' + p.r + ', ' + p.g + ', ' + p.b + ', 0.07)',
    '--shadow-card: 0 4rpx 20rpx rgba(' + p.r + ', ' + p.g + ', ' + p.b + ', 0.10)',
    '--shadow-button: 0 8rpx 24rpx rgba(' + p.r + ', ' + p.g + ', ' + p.b + ', 0.18)',
    '--shadow-elevated: 0 8rpx 28rpx rgba(' + p.r + ', ' + p.g + ', ' + p.b + ', 0.10)',
    '--shadow-primary: 0 4rpx 16rpx rgba(' + p.r + ', ' + p.g + ', ' + p.b + ', 0.25)',
    '--glass-shadow-card: 0 4rpx 20rpx rgba(' + p.r + ', ' + p.g + ', ' + p.b + ', 0.08)',
    '--glass-shadow-elevated: 0 6rpx 28rpx rgba(' + p.r + ', ' + p.g + ', ' + p.b + ', 0.12)',
    '--glass-shadow-button: 0 6rpx 20rpx rgba(' + p.r + ', ' + p.g + ', ' + p.b + ', 0.22)',
  ];

  return vars.join('; ') + ';';
}

/**
 * 获取预构建的 CSS 变量样式字符串（同步）
 * 在 loadThemeConfig 完成前返回空字符串（使用 app.wxss 默认值）
 * @returns {string}
 */
function getThemeStyle() {
  return _themeStyle;
}

/**
 * 获取单个主题颜色值（供 JS API 使用，如 wx.showModal confirmColor）
 * @param {string} key - 'primary' | 'secondary' | 'tertiary' | 'accent'
 * @returns {string} hex 颜色值
 */
function getThemeColor(key) {
  if (!_themeConfig) return DEFAULTS[key + 'Color'] || DEFAULTS.primaryColor;
  return _themeConfig[key + 'Color'] || DEFAULTS[key + 'Color'] || DEFAULTS.primaryColor;
}

/**
 * 获取导航栏专用的背景样式字符串（直接 rgba 值，不依赖 CSS 变量继承）
 * 用于顶部 top-bar 和底部 tab-bar 的 style 属性
 * @returns {{ nav: string, tabBar: string }}
 */
function getNavBarStyle() {
  const cfg = _themeConfig || DEFAULTS;
  const glass = GLASS_PRESETS[cfg.glassIntensity] || GLASS_PRESETS.medium;
  const navTint = lighten(cfg.primaryColor, 0.05);
  const nr = hexToRgb(navTint);
  const tabTint = lighten(cfg.primaryColor, 0.10);
  const tr = hexToRgb(tabTint);
  return {
    nav: 'background: rgba(' + nr.r + ', ' + nr.g + ', ' + nr.b + ', ' + glass.navOpacity + ');' +
         '-webkit-backdrop-filter: ' + ('saturate(200%) blur(' + glass.blur + ')') + ';' +
         'backdrop-filter: ' + ('saturate(200%) blur(' + glass.blur + ')') + ';',
    tabBar: 'background: rgba(' + tr.r + ', ' + tr.g + ', ' + tr.b + ', ' + glass.elevatedOpacity + ');' +
            '-webkit-backdrop-filter: ' + ('saturate(200%) blur(' + glass.blurLg + ')') + ';' +
            'backdrop-filter: ' + ('saturate(200%) blur(' + glass.blurLg + ')') + ';',
  };
}

/**
 * 清除缓存（管理员修改主题后调用）
 */
function clearThemeCache() {
  _themeConfig = null;
  _themePromise = null;
  _themeStyle = '';
}

module.exports = {
  loadThemeConfig,
  buildThemeStyle,
  getThemeStyle,
  getThemeColor,
  getNavBarStyle,
  clearThemeCache,
  DEFAULTS,
};
