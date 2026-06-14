import { request } from '../request';

export function fetchOrders(params?: Record<string, any>) {
  return request<any[]>({ url: '/orders', params });
}

export function fetchOrder(id: string | number) {
  return request<any>({ url: `/orders/${id}` });
}

export function fetchUpdateOrderStatus(id: string | number, status: string) {
  return request<any>({ url: `/orders/${id}/status`, method: 'put', data: { status } });
}
