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
