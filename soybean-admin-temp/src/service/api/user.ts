import { request } from '../request';

export interface UserEditData {
  name?: string;
  phone?: string;
  points?: number;
  balance?: number;
  totalSpent?: number;
  memberLevel?: string;
  birthday?: string | null;
}

export function fetchUsers(params?: Record<string, any>) {
  return request<any>({ url: '/users', params });
}

export function fetchUpdateUser(id: number, data: UserEditData) {
  return request<any>({ url: `/users/${id}`, method: 'put', data });
}

export function fetchUpdateUserBirthday(id: number, birthday: string | null) {
  return request<any>({ url: `/users/${id}/birthday`, method: 'put', data: { birthday } });
}
