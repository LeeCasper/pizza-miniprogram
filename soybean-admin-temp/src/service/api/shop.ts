import { request } from '../request';

export interface AdminShopProduct {
  id: number;
  shop_category_key: string | null;
  name: string;
  subtitle: string;
  price: string;
  original_price: string | null;
  main_image: string;
  images: string[];
  detail_desc: string;
  stock: number;
  sales: number;
  tag: string;
  is_available: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface AdminShopCategory {
  key: string;
  name: string;
  icon: string;
  sort_order: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

// ───── 商品 ─────
export function fetchShopProducts() {
  return request<AdminShopProduct[]>({ url: '/shop/products' });
}

export function fetchShopProduct(id: number) {
  return request<AdminShopProduct>({ url: `/shop/products/${id}` });
}

export function fetchCreateShopProduct(data: Record<string, any>) {
  return request<AdminShopProduct>({ url: '/shop/products', method: 'post', data });
}

export function fetchUpdateShopProduct(id: number, data: Record<string, any>) {
  return request<AdminShopProduct>({ url: `/shop/products/${id}`, method: 'put', data });
}

export function fetchDeleteShopProduct(id: number) {
  return request<void>({ url: `/shop/products/${id}`, method: 'delete' });
}

export function fetchToggleShopProduct(id: number) {
  return request<AdminShopProduct>({ url: `/shop/products/${id}/toggle`, method: 'put' });
}

// ───── 分类 ─────
export function fetchShopCategories() {
  return request<AdminShopCategory[]>({ url: '/shop/categories' });
}

export function fetchCreateShopCategory(data: Record<string, any>) {
  return request<AdminShopCategory>({ url: '/shop/categories', method: 'post', data });
}

export function fetchUpdateShopCategory(key: string, data: Record<string, any>) {
  return request<AdminShopCategory>({ url: `/shop/categories/${key}`, method: 'put', data });
}

export function fetchDeleteShopCategory(key: string) {
  return request<void>({ url: `/shop/categories/${key}`, method: 'delete' });
}
