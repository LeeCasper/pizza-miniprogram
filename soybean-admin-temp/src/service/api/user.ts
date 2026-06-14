import { request } from '../request';

export function fetchUsers(params?: Record<string, any>) {
  return request<any>({ url: '/users', params });
}
