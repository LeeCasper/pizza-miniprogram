import { request } from '../request';

export function fetchCoupons(params?: Record<string, any>) {
  return request<any>({ url: '/coupons', params });
}
