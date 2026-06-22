import { request } from '../request';

export interface LuckyPrize {
  id: number;
  type: 'coupon' | 'points' | 'balance' | 'thanks' | 'again';
  name: string;
  weight: number;
  stock: number | null;
  awardedCount: number;
  couponTemplateId: number | null;
  pointsAmount: number | null;
  balanceAmount: number | null;
  color: string;
  icon: string;
  sortOrder: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface LuckyRecord {
  id: number;
  userId: number;
  userName?: string;
  prizeType: string;
  prizeName: string;
  source: 'free' | 'points' | 'again';
  costPoints: number;
  couponId: number | null;
  pointsAmount: number | null;
  balanceAmount: number | null;
  createdAt: string;
}

export interface LuckyConfig {
  enabled: boolean;
  freePerDay: number;
  pointsCost: number;
  maxPerDay: number;
}

export function fetchLuckyPrizes() {
  return request<LuckyPrize[]>({ url: '/lucky-wheel/prizes' });
}

export function fetchLuckyPrize(id: number) {
  return request<LuckyPrize>({ url: `/lucky-wheel/prizes/${id}` });
}

export function fetchCreateLuckyPrize(payload: Partial<LuckyPrize>) {
  return request<{ id: number }>({ url: '/lucky-wheel/prizes', method: 'post', data: payload });
}

export function fetchUpdateLuckyPrize(id: number, payload: Partial<LuckyPrize>) {
  return request<{ updated: boolean }>({ url: `/lucky-wheel/prizes/${id}`, method: 'put', data: payload });
}

export function fetchDeleteLuckyPrize(id: number) {
  return request<{ deleted: boolean }>({ url: `/lucky-wheel/prizes/${id}`, method: 'delete' });
}

export function fetchToggleLuckyPrize(id: number) {
  return request<{ isActive: boolean }>({ url: `/lucky-wheel/prizes/${id}/toggle`, method: 'put' });
}

export function fetchLuckyRecords(params?: { page?: number; limit?: number }) {
  return request<{ list: LuckyRecord[]; total: number }>({ url: '/lucky-wheel/records', params });
}

export function fetchLuckyConfig() {
  return request<LuckyConfig>({ url: '/lucky-wheel/config' });
}

export function fetchUpdateLuckyConfig(payload: LuckyConfig) {
  return request<LuckyConfig>({ url: '/lucky-wheel/config', method: 'put', data: payload });
}
