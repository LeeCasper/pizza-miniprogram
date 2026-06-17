import { request } from '../request';

export interface PaymentRecord {
  id: number;
  userId: number;
  userName: string | null;
  userPhone: string | null;
  type: 'order' | 'recharge';
  referenceId: string;
  outTradeNo: string;
  transactionId: string | null;
  amount: number;
  status: 'pending' | 'success' | 'failed' | 'closed';
  createdAt: string;
  updatedAt: string;
}

export interface PaymentListResult {
  list: PaymentRecord[];
  total: number;
}

export function fetchPaymentRecords(params?: {
  type?: string;
  status?: string;
  page?: number;
  limit?: number;
}) {
  return request<PaymentListResult>({ url: '/payment-records', params });
}

export function fetchPaymentRecord(id: number) {
  return request<PaymentRecord>({ url: `/payment-records/${id}` });
}
