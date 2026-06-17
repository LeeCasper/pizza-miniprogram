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
