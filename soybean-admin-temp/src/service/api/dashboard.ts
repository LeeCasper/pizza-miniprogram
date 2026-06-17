import { request } from '../request';

export interface DashboardStats {
  todayOrders: number;
  totalUsers: number;
  activeCoupons: number;
  todayRevenue: number;
  todayOrdersPaid: number;
  pendingPayments: number;
  rechargeRevenue: number;
  rechargeCount: number;
}

export function fetchDashboardStats() {
  return request<DashboardStats>({ url: '/dashboard/stats' });
}
