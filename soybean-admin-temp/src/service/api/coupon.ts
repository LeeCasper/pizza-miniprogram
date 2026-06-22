import { request } from '../request';

export interface Coupon {
  id: number;
  userName?: string;
  name: string;
  category: 'redeem' | 'discount';
  code: string;
  value: string;
  status: 'available' | 'used' | 'expired';
  validTo?: string;
}

export function fetchCoupons(params?: Record<string, any>) {
  return request<Coupon[]>({ url: '/coupons', params });
}

export function fetchAssignCoupon(templateId: number, userIds: number[]) {
  return request<{ assigned: number }>({ url: '/coupons/assign', method: 'post', data: { templateId, userIds } });
}
