import { request } from '../request';

export interface UserEditData {
  name?: string;
  phone?: string;
  points?: number;
  balance?: number;
  totalSpent?: number;
  memberLevel?: string;
}

export function fetchUsers(params?: Record<string, any>) {
  return request<any>({ url: '/users', params });
}

export function fetchUpdateUser(id: number, data: UserEditData) {
  return request<any>({ url: `/users/${id}`, method: 'put', data });
}
