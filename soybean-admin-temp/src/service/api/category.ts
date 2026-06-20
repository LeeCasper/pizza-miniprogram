import { request } from '../request';

export interface AdminCategory {
  id: number;
  key: string;
  name: string;
  icon: string;
  sort_order: number;
  is_active: number;
}

export function fetchCategories() {
  return request<AdminCategory[]>({ url: '/categories' });
}

export function fetchCreateCategory(data: Record<string, any>) {
  return request<AdminCategory>({ url: '/categories', method: 'post', data });
}

export function fetchUpdateCategory(key: string, data: Record<string, any>) {
  return request<AdminCategory>({ url: `/categories/${key}`, method: 'put', data });
}

export function fetchDeleteCategory(key: string) {
  return request<void>({ url: `/categories/${key}`, method: 'delete' });
}
