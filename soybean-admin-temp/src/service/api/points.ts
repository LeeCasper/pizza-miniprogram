import { request } from '../request';

export interface PointsProduct {
  id?: number;
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
