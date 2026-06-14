import { request } from '../request';

export interface DashboardStats {
  todayOrders: number;
  totalUsers: number;
  activeCoupons: number;
}

export function fetchDashboardStats() {
  return request<DashboardStats>({ url: '/dashboard/stats' });
}
