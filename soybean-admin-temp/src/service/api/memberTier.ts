import { request } from '../request';

export interface MemberTier {
  id?: number;
  levelKey: string;
  name: string;
  levelIndex: number;
  minSpent: number;
  discountRate: number;
  pointsRewardRate: number;
  birthdayGift: string;
  couponValue: number;
  birthdayCouponValue: number;
  birthdayCouponType?: string;
  birthdayCouponMinSpend?: number;
  birthdayCouponValidDays?: number;
  birthdayCoupon2Value?: number;
  birthdayCoupon2Type?: string;
  birthdayCoupon2MinSpend?: number;
  birthdayCoupon2ValidDays?: number;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export function fetchMemberTiers() {
  return request<MemberTier[]>({ url: '/member-tiers' });
}

export function fetchMemberTier(id: number) {
  return request<MemberTier>({ url: `/member-tiers/${id}` });
}

export function fetchCreateMemberTier(data: Partial<MemberTier>) {
  return request<MemberTier>({ url: '/member-tiers', method: 'post', data });
}

export function fetchUpdateMemberTier(id: number, data: Partial<MemberTier>) {
  return request<MemberTier>({ url: `/member-tiers/${id}`, method: 'put', data });
}

export function fetchDeleteMemberTier(id: number) {
  return request<void>({ url: `/member-tiers/${id}`, method: 'delete' });
}

export function fetchToggleMemberTier(id: number) {
  return request<MemberTier>({ url: `/member-tiers/${id}/toggle`, method: 'put' });
}
