import request from '../request'

export const couponApi = {
  list(params?: { status?: string; category?: string; page?: number; limit?: number }) {
    return request.get('/coupons', { params }).then(r => r.data)
  },
}
