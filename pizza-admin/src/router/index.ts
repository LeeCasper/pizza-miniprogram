import { createRouter, createWebHashHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/_builtin/login/index.vue'),
    meta: { title: '登录', public: true },
  },
  {
    path: '/',
    redirect: '/dashboard',
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('@/views/dashboard/index.vue'),
    meta: { title: '仪表盘' },
  },
  {
    path: '/products',
    name: 'Products',
    component: () => import('@/views/products/list/index.vue'),
    meta: { title: '商品管理' },
  },
  {
    path: '/products/create',
    name: 'ProductCreate',
    component: () => import('@/views/products/form/index.vue'),
    meta: { title: '新建商品' },
  },
  {
    path: '/products/:id/edit',
    name: 'ProductEdit',
    component: () => import('@/views/products/form/index.vue'),
    meta: { title: '编辑商品' },
  },
  {
    path: '/orders',
    name: 'Orders',
    component: () => import('@/views/orders/list/index.vue'),
    meta: { title: '订单管理' },
  },
  {
    path: '/orders/:id',
    name: 'OrderDetail',
    component: () => import('@/views/orders/detail/index.vue'),
    meta: { title: '订单详情' },
  },
  {
    path: '/coupons',
    name: 'Coupons',
    component: () => import('@/views/coupons/list/index.vue'),
    meta: { title: '优惠券' },
  },
  {
    path: '/users',
    name: 'Users',
    component: () => import('@/views/users/list/index.vue'),
    meta: { title: '用户管理' },
  },
  {
    path: '/points',
    name: 'Points',
    component: () => import('@/views/points/list/index.vue'),
    meta: { title: '积分商城' },
  },
  {
    path: '/points/create',
    name: 'PointsCreate',
    component: () => import('@/views/points/form/index.vue'),
    meta: { title: '新建积分商品' },
  },
  {
    path: '/points/:id/edit',
    name: 'PointsEdit',
    component: () => import('@/views/points/form/index.vue'),
    meta: { title: '编辑积分商品' },
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

// Navigation guard
router.beforeEach((to, _from, next) => {
  const token = localStorage.getItem('admin_token')
  if (!to.meta.public && !token) {
    next('/login')
  } else if (to.path === '/login' && token) {
    next('/dashboard')
  } else {
    next()
  }
})

export default router
