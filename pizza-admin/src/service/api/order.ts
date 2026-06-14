import request from '../request'

export const orderApi = {
  list(params?: { status?: string; page?: number; limit?: number }) {
    return request.get('/orders', { params }).then(r => r.data)
  },
  get(id: string) {
    return request.get(`/orders/${id}`).then(r => r.data)
  },
  updateStatus(id: string, status: string) {
    return request.put(`/orders/${id}/status`, { status }).then(r => r.data)
  },
}
