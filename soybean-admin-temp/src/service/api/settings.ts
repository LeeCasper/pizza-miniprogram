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
  refundNotifyUrl: string;
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
  refundNotifyUrl?: string;
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
  pickup_notice: string;
}

export interface StoreSettingsForm {
  name?: string;
  address?: string;
  phone?: string;
  latitude?: number | null;
  longitude?: number | null;
  business_hours?: string;
  pickup_notice?: string;
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
  shopEnabled: boolean;
  shopNotice: string;
  icpBeian: string;
  gonganBeian: string;
}

export interface BusinessSettingsForm {
  orderCancelMinutes?: number;
  unpaidTimeoutMinutes?: number;
  storeName?: string;
  shopEnabled?: boolean;
  shopNotice?: string;
  icpBeian?: string;
  gonganBeian?: string;
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

// ── Logistics Settings ────────────────────────────────

export interface LogisticsSettings {
  customer: string;
  key: string;
  enabled: boolean;
  _hasKey: boolean;
}

export interface LogisticsSettingsForm {
  customer?: string;
  key?: string;
  enabled?: boolean;
}

/** Get logistics (快递100) settings */
export function fetchLogisticsSettings() {
  return request<LogisticsSettings>({
    url: '/settings/logistics',
    method: 'GET',
  });
}

/** Update logistics settings */
export function fetchUpdateLogisticsSettings(data: LogisticsSettingsForm) {
  return request<null>({
    url: '/settings/logistics',
    method: 'PUT',
    data,
  });
}

// ── Storage Settings ─────────────────────────────────

export interface StorageSettings {
  storageType: string;
  cosSecretId: string;
  cosSecretKey: string;
  cosBucket: string;
  cosRegion: string;
  cosBaseUrl: string;
  _hasSecretKey: boolean;
}

export interface StorageSettingsForm {
  storageType?: string;
  cosSecretId?: string;
  cosSecretKey?: string;
  cosBucket?: string;
  cosRegion?: string;
  cosBaseUrl?: string;
}

export function fetchStorageSettings() {
  return request<StorageSettings>({
    url: '/settings/storage',
    method: 'GET',
  });
}

export function fetchUpdateStorageSettings(data: StorageSettingsForm) {
  return request<null>({
    url: '/settings/storage',
    method: 'PUT',
    data,
  });
}

// ── Theme Settings removed ──

// ── Default Avatars ─────────────────────────────────

export interface DefaultAvatar {
  id: number;
  url: string;
  sort_order: number;
}

export function fetchDefaultAvatars() {
  return request<DefaultAvatar[]>({
    url: '/default-avatars',
    method: 'GET',
  });
}

export function fetchAddDefaultAvatar(url: string) {
  return request<DefaultAvatar>({
    url: '/default-avatars',
    method: 'POST',
    data: { url },
  });
}

export function fetchDeleteDefaultAvatar(id: number) {
  return request<null>({
    url: `/default-avatars/${id}`,
    method: 'DELETE',
  });
}

// ── Content Settings (关于我们 / 用户协议 / 隐私政策) ──

export interface ContentItem {
  config_key: string;
  config_value: string;
  updated_at: string | null;
  label: string;
}

export function fetchContentSettings() {
  return request<ContentItem[]>({
    url: '/settings/content',
    method: 'GET',
  });
}

export function fetchUpdateContentSettings(key: string, value: string) {
  return request<null>({
    url: `/settings/content/${key}`,
    method: 'PUT',
    data: { value },
  });
}
