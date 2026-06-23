import { request } from '../request';

export interface CouponTemplate {
  id?: number;
  name: string;
  desc: string;
  category: 'redeem' | 'discount';
  value: string;
  discountType: 'free_redeem' | 'buy_one_get_one' | 'free_delivery' | 'half_price' | 'fixed_amount' | 'percentage';
  discountValue: string;
  minSpend: number;
  validDays: number;
  color: string;
  useTip: string;
  claimable?: boolean;
  totalStock?: number | null;
  claimedCount?: number;
  perUserLimit?: number;
  claimPeriod?: 'none' | 'weekly' | 'monthly';
  minMemberLevel?: number;
  maxDiscount?: number | null;
  image?: string;
  redeemProductName?: string;
  redeemProductPrice?: number | null;
  redeemProductImage?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export function fetchCouponTemplates() {
  return request<CouponTemplate[]>({ url: '/coupon-templates' });
}

export function fetchCouponTemplate(id: number) {
  return request<CouponTemplate>({ url: `/coupon-templates/${id}` });
}

export function fetchCreateCouponTemplate(data: Partial<CouponTemplate>) {
  return request<CouponTemplate>({ url: '/coupon-templates', method: 'post', data });
}

export function fetchUpdateCouponTemplate(id: number, data: Partial<CouponTemplate>) {
  return request<CouponTemplate>({ url: `/coupon-templates/${id}`, method: 'put', data });
}

export function fetchDeleteCouponTemplate(id: number) {
  return request<void>({ url: `/coupon-templates/${id}`, method: 'delete' });
}

export function fetchToggleCouponTemplate(id: number) {
  return request<CouponTemplate>({ url: `/coupon-templates/${id}/toggle`, method: 'put' });
}
