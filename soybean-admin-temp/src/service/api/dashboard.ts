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

export interface OrderTrendItem {
  date: string;
  orders: number;
  revenue: number;
}

export interface StatusDistItem {
  status: string;
  count: number;
}

export interface DashboardCharts {
  orderTrend: OrderTrendItem[];
  statusDistribution: StatusDistItem[];
}

export function fetchDashboardStats() {
  return request<DashboardStats>({ url: '/dashboard/stats' });
}

export function fetchDashboardCharts() {
  return request<DashboardCharts>({ url: '/dashboard/charts' });
}
