import request from '../request'

export interface Product {
  id: number
  category_key: string
  name: string
  desc: string
  detail_desc: string
  price: number
  image: string
  tag: string
  size_desc: string
  ingredients: string[]
  is_available: number
  sort_order: number
  created_at?: string
  updated_at?: string
}

export const productApi = {
  list() {
    return request.get('/products').then(r => r.data)
  },
  get(id: number) {
    return request.get(`/products/${id}`).then(r => r.data)
  },
  create(data: Partial<Product>) {
    return request.post('/products', data).then(r => r.data)
  },
  update(id: number, data: Partial<Product>) {
    return request.put(`/products/${id}`, data).then(r => r.data)
  },
  remove(id: number) {
    return request.delete(`/products/${id}`).then(r => r.data)
  },
}
