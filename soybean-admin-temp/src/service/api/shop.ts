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
  detail_images: string[];
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

// ───── Shop Order Types ─────
export interface AdminShopOrderItem {
  id: number;
  orderId: string;
  shopProductId: number | null;
  productName: string;
  productImage: string | null;
  price: string;
  quantity: number;
  subtotal: string;
}

export interface AdminShopOrder {
  id: string;
  userId: number;
  userName?: string;
  totalAmount: string;
  paidAmount: string;
  paymentMethod: string | null;
  status: string;
  statusLabel?: string;
  recipientName: string | null;
  recipientPhone: string | null;
  recipientAddress: string | null;
  shippingCompany: string | null;
  trackingNo: string | null;
  note: string | null;
  paidAt: string | null;
  shippedAt: string | null;
  completedAt: string | null;
  refundAmount: string | null;
  refundReason: string | null;
  refundStatus: string | null;
  refundedAt: string | null;
  createdAt: string;
  updatedAt: string;
  items?: AdminShopOrderItem[];
}

// ───── Shop Order API ─────
export function fetchShopOrders(params?: Record<string, any>) {
  return request<{ list: AdminShopOrder[]; total: number }>({ url: '/shop/orders', params });
}

export function fetchShopOrder(id: string) {
  return request<AdminShopOrder>({ url: `/shop/orders/${id}` });
}

export function fetchUpdateShopOrderStatus(id: string, status: string, reason?: string) {
  return request<AdminShopOrder>({ url: `/shop/orders/${id}/status`, method: 'put', data: { status, reason: reason || undefined } });
}

export function fetchUpdateShopOrderShipping(id: string, data: { shippingCompany: string; trackingNo: string }) {
  return request<AdminShopOrder>({ url: `/shop/orders/${id}/shipping`, method: 'put', data });
}

// ───── Carrier Auto-Detect ─────
export interface CarrierOption {
  comCode: string;
  name: string;
  lengthPre?: number[];
}

export interface AutoDetectResult {
  com: CarrierOption[];
  auto: CarrierOption[];
  state: string;
}

export function fetchAutoDetectCarrier(trackingNo: string) {
  return request<AutoDetectResult>({ url: '/shop/auto-detect-carrier', method: 'post', data: { trackingNo } });
}
