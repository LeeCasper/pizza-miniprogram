import { request } from '../request';

/**
 * Admin login
 *
 * @param username Username
 * @param password Password
 */
export function fetchLogin(username: string, password: string) {
  return request<{ token: string; user: { id: number; username: string; displayName: string } }>({
    url: '/login',
    method: 'post',
    data: { username, password }
  });
}

/** Get admin profile */
export function fetchGetUserInfo() {
  return request<{ id: number; username: string; displayName: string }>({
    url: '/profile'
  });
}
