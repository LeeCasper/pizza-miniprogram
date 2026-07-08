import { request } from '../request';

export interface PointsProduct {
  id?: number;
  pointsCategoryKey: string | null;
  name: string;
  desc: string;
  detailDesc: string;
  points: number;
  image: string;
  stock: number;
  tag: string;
  highlights: string[];
  redeemType: string;
  couponName: string;
  couponCategory: string;
  couponValue: string;
  couponDiscountType: string;
  couponDiscountValue: string;
  couponMinSpend: number;
  couponValidDays: number;
  useTip: string;
  isActive?: number;
}

// ── Points Categories ──
export interface PointsCategory {
  key: string;
  name: string;
  icon: string | null;
  sort_order: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export function fetchPointsCategories() {
  return request<PointsCategory[]>({ url: '/points/categories' });
}

export function fetchCreatePointsCategory(data: { key: string; name: string; icon?: string; sortOrder?: number; isActive?: number }) {
  return request<PointsCategory>({ url: '/points/categories', method: 'post', data });
}

export function fetchUpdatePointsCategory(key: string, data: { name?: string; icon?: string; sortOrder?: number; isActive?: number }) {
  return request<PointsCategory>({ url: `/points/categories/${key}`, method: 'put', data });
}

export function fetchDeletePointsCategory(key: string) {
  return request<void>({ url: `/points/categories/${key}`, method: 'delete' });
}

export function fetchPointsProducts() {
  return request<PointsProduct[]>({ url: '/points/products' });
}

export function fetchPointsProduct(id: number) {
  return request<PointsProduct>({ url: `/points/products/${id}` });
}

export function fetchCreatePointsProduct(data: PointsProduct) {
  return request<{ id: number }>({ url: '/points/products', method: 'post', data });
}

export function fetchUpdatePointsProduct(id: number, data: Partial<PointsProduct>) {
  return request<void>({ url: `/points/products/${id}`, method: 'put', data });
}

export function fetchDeletePointsProduct(id: number) {
  return request<void>({ url: `/points/products/${id}`, method: 'delete' });
}

export function fetchTogglePointsProduct(id: number) {
  return request<void>({ url: `/points/products/${id}/toggle`, method: 'put' });
}
