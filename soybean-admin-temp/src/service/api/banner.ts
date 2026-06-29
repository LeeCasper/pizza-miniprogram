import { request } from '../request';

export interface Banner {
  id?: number;
  imageUrl: string;
  title: string;
  subtitle: string;
  tag: string;
  linkType: 'product' | 'none' | 'coupon' | 'points' | 'lucky-wheel' | 'url';
  linkProductId: number | null;
  linkUrl: string | null;
  scope: 'pos' | 'shop' | 'both';
  sortOrder: number;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export function fetchBanners() {
  return request<Banner[]>({ url: '/banners' });
}

export function fetchBanner(id: number) {
  return request<Banner>({ url: `/banners/${id}` });
}

export function fetchCreateBanner(data: Partial<Banner>) {
  return request<Banner>({ url: '/banners', method: 'post', data });
}

export function fetchUpdateBanner(id: number, data: Partial<Banner>) {
  return request<Banner>({ url: `/banners/${id}`, method: 'put', data });
}

export function fetchDeleteBanner(id: number) {
  return request<void>({ url: `/banners/${id}`, method: 'delete' });
}

export function fetchToggleBanner(id: number) {
  return request<Banner>({ url: `/banners/${id}/toggle`, method: 'put' });
}
