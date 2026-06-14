import request from '../request'

export const userApi = {
  list(params?: { search?: string; page?: number; limit?: number }) {
    return request.get('/users', { params }).then(r => r.data)
  },
}
