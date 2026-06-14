import request from '../request'

export const dashboardApi = {
  getStats() {
    return request.get('/dashboard/stats').then(r => r.data)
  },
}
