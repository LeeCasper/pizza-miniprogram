import request from '../request'

export interface PointsProduct {
  id?: number
  name: string
  desc: string
  detailDesc: string
  points: number
  image: string
  stock: number
  tag: string
  highlights: string[]
  redeemType: string
  couponName: string
  couponCategory: string
  couponValue: string
  couponDiscountType: string
  couponDiscountValue: string
  couponMinSpend: number
  couponValidDays: number
  useTip: string
  isActive?: number
}

export const pointsApi = {
  list() {
    return request.get('/points/products').then(r => r.data)
  },
  get(id: number) {
    return request.get(`/points/products/${id}`).then(r => r.data)
  },
  create(data: PointsProduct) {
    return request.post('/points/products', data).then(r => r.data)
  },
  update(id: number, data: Partial<PointsProduct>) {
    return request.put(`/points/products/${id}`, data).then(r => r.data)
  },
}
