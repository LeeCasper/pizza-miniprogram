import { request } from '../request';

/** Get WeChat Pay settings (sensitive fields masked) */
export function fetchPaySettings() {
  return request<PaySettings>({
    url: '/settings/pay',
    method: 'GET',
  });
}

/** Update WeChat Pay settings */
export function fetchUpdatePaySettings(data: PaySettingsForm) {
  return request<null>({
    url: '/settings/pay',
    method: 'PUT',
    data,
  });
}

export interface PaySettings {
  mchId: string;
  apiV3Key: string;
  certSerialNo: string;
  privateKey: string;
  platformCert: string;
  notifyUrl: string;
  _hasPrivateKey?: boolean;
  _hasPlatformCert?: boolean;
}

export interface PaySettingsForm {
  mchId?: string;
  apiV3Key?: string;
  certSerialNo?: string;
  privateKey?: string;
  platformCert?: string;
  notifyUrl?: string;
}

// ── Printer Settings ──────────────────────────────────

/** Get printer settings (sensitive fields masked) */
export function fetchPrinterSettings() {
  return request<PrinterSettings>({
    url: '/settings/printer',
    method: 'GET',
  });
}

/** Update printer settings */
export function fetchUpdatePrinterSettings(data: PrinterSettingsForm) {
  return request<null>({
    url: '/settings/printer',
    method: 'PUT',
    data,
  });
}

/** Test printer */
export function fetchTestPrinter() {
  return request<null>({
    url: '/settings/printer/test',
    method: 'POST',
  });
}

export interface PrinterSettings {
  enabled: boolean;
  appId: string;
  appSecret: string;
  sn: string;
  pkey: string;
  apiBase: string;
  copies: number;
  _hasAppSecret?: boolean;
  _hasPkey?: boolean;
  // 小票模板
  storeName: string;
  footerText: string;
  footerTip: string;
  audioEnabled: boolean;
}

export interface PrinterSettingsForm {
  enabled?: boolean;
  appId?: string;
  appSecret?: string;
  sn?: string;
  pkey?: string;
  apiBase?: string;
  copies?: number;
  // 小票模板
  storeName?: string;
  footerText?: string;
  footerTip?: string;
  audioEnabled?: boolean;
}

/** Get printer preview content */
export function fetchPrinterPreview() {
  return request<PrinterPreview>({
    url: '/settings/printer/preview',
    method: 'GET',
  });
}

export interface PrinterPreview {
  raw: string;
  plain: string;
}

// ── Map Settings ─────────────────────────────────────

export interface MapSettings {
  tencentKey: string;
  _hasTencentKey: boolean;
}

export interface MapSettingsForm {
  tencentKey?: string;
}

/** Get map settings (sensitive fields masked) */
export function fetchMapSettings() {
  return request<MapSettings>({
    url: '/settings/map',
    method: 'GET',
  });
}

/** Update map settings */
export function fetchUpdateMapSettings(data: MapSettingsForm) {
  return request<null>({
    url: '/settings/map',
    method: 'PUT',
    data,
  });
}

// ── Store Settings ───────────────────────────────────

export interface StoreSettings {
  id: number;
  name: string;
  address: string;
  phone: string;
  latitude: number | null;
  longitude: number | null;
  business_hours: string;
  image: string;
  desc: string;
}

export interface StoreSettingsForm {
  name?: string;
  address?: string;
  phone?: string;
  latitude?: number | null;
  longitude?: number | null;
  business_hours?: string;
}

/** Get store settings */
export function fetchStoreSettings() {
  return request<StoreSettings>({
    url: '/settings/store',
    method: 'GET',
  });
}

/** Update store settings */
export function fetchUpdateStoreSettings(data: StoreSettingsForm) {
  return request<null>({
    url: '/settings/store',
    method: 'PUT',
    data,
  });
}

// ── Business Settings ────────────────────────────────

export interface BusinessSettings {
  orderCancelMinutes: number;
  unpaidTimeoutMinutes: number;
  storeName: string;
}

export interface BusinessSettingsForm {
  orderCancelMinutes?: number;
  unpaidTimeoutMinutes?: number;
  storeName?: string;
}

/** Get business settings */
export function fetchBusinessSettings() {
  return request<BusinessSettings>({
    url: '/settings/business',
    method: 'GET',
  });
}

/** Update business settings */
export function fetchUpdateBusinessSettings(data: BusinessSettingsForm) {
  return request<null>({
    url: '/settings/business',
    method: 'PUT',
    data,
  });
}

// ── Theme Settings ──────────────────────────────────

export type ThemePageKey = 'index' | 'orders' | 'shop' | 'profile' | 'detail' | 'checkout' | 'pickup' | 'tiers';

/** 单页主题覆盖（每项可选，留空=跟随全局） */
export interface PageThemeOverride {
  cardColor?: string;
  priceColor?: string;
  navColor?: string;
  buttonColor?: string;
  textColor?: string;
  gradient1?: string;
  gradient2?: string;
  gradient3?: string;
  gradient4?: string;
}

export interface ThemeSettings {
  primaryColor: string;
  secondaryColor: string;
  tertiaryColor: string;
  accentColor: string;
  gradientColor1: string;
  gradientColor2: string;
  gradientColor3: string;
  gradientColor4: string;
  glassIntensity: 'low' | 'medium' | 'high';
  pageOverrides?: Partial<Record<ThemePageKey, PageThemeOverride>>;
}

export interface ThemeSettingsForm {
  primaryColor?: string;
  secondaryColor?: string;
  tertiaryColor?: string;
  accentColor?: string;
  gradientColor1?: string;
  gradientColor2?: string;
  gradientColor3?: string;
  gradientColor4?: string;
  glassIntensity?: 'low' | 'medium' | 'high';
  pageOverrides?: Partial<Record<ThemePageKey, PageThemeOverride>>;
}

/** Get theme settings */
export function fetchThemeSettings() {
  return request<ThemeSettings>({
    url: '/settings/theme',
    method: 'GET',
  });
}

/** Update theme settings */
export function fetchUpdateThemeSettings(data: ThemeSettingsForm) {
  return request<null>({
    url: '/settings/theme',
    method: 'PUT',
    data,
  });
}
