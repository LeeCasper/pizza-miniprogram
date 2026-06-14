import { request } from '../request';

export interface AdminProduct {
  id: number;
  category_key: string;
  name: string;
  desc: string;
  detail_desc: string;
  price: string;
  image: string;
  tag: string;
  size_desc: string;
  ingredients: string[];
  is_available: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export function fetchProducts() {
  return request<AdminProduct[]>({ url: '/products' });
}

export function fetchProduct(id: number) {
  return request<AdminProduct>({ url: `/products/${id}` });
}

export function fetchCreateProduct(data: Record<string, any>) {
  return request<AdminProduct>({ url: '/products', method: 'post', data });
}

export function fetchUpdateProduct(id: number, data: Record<string, any>) {
  return request<AdminProduct>({ url: `/products/${id}`, method: 'put', data });
}

export function fetchDeleteProduct(id: number) {
  return request<void>({ url: `/products/${id}`, method: 'delete' });
}
