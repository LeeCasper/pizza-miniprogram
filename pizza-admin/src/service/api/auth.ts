import request from '../request'

export const authApi = {
  login(username: string, password: string) {
    return request.post('/login', { username, password }).then(r => r.data)
  },
  getProfile() {
    return request.get('/profile').then(r => r.data)
  },
}
