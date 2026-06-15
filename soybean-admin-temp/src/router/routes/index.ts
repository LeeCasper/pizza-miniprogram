import type { CustomRoute, ElegantConstRoute, ElegantRoute } from '@elegant-router/types';
import { generatedRoutes } from '../elegant/routes';
import { layouts, views } from '../elegant/imports';
import { transformElegantRoutesToVueRoutes } from '../elegant/transform';

/**
 * custom routes
 *
 * @link https://github.com/soybeanjs/elegant-router?tab=readme-ov-file#custom-route
 */
const customRoutes: CustomRoute[] = [
  // Single-level routes — use layout.base$view.xxx syntax
  {
    name: 'dashboard',
    path: '/dashboard',
    component: 'layout.base$view.dashboard',
    meta: {
      title: '仪表盘',
      i18nKey: 'route.dashboard',
      icon: 'mdi:monitor-dashboard',
      order: 1,
    },
  },
  {
    name: 'banners',
    path: '/banners',
    component: 'layout.base',
    meta: {
      title: '轮播图管理',
      i18nKey: 'route.banners',
      icon: 'mdi:image-multiple',
      order: 4.5,
    },
    children: [
      {
        name: 'banners_list',
        path: '/banners/list',
        component: 'view.banners_list',
        meta: {
          title: '轮播图列表',
          i18nKey: 'route.banners_list',
        },
      },
      {
        name: 'banners_create',
        path: '/banners/create',
        component: 'view.banners_form',
        meta: {
          title: '新建轮播图',
          i18nKey: 'route.banners_create',
          hideInMenu: true,
        },
      },
      {
        name: 'banners_edit',
        path: '/banners/:id/edit',
        component: 'view.banners_form',
        props: true,
        meta: {
          title: '编辑轮播图',
          i18nKey: 'route.banners_edit',
          hideInMenu: true,
        },
      },
    ],
  },
  {
    name: 'files',
    path: '/files',
    component: 'layout.base$view.files_list',
    meta: {
      title: '文件管理',
      i18nKey: 'route.files',
      icon: 'mdi:folder-open',
      order: 7,
    },
  },
  // Multi-level routes — parent has layout.base, children have view.xxx
  {
    name: 'products',
    path: '/products',
    component: 'layout.base',
    meta: {
      title: '商品管理',
      i18nKey: 'route.products',
      icon: 'mdi:shopping',
      order: 2,
    },
    children: [
      {
        name: 'products_list',
        path: '/products/list',
        component: 'view.products_list',
        meta: {
          title: '商品列表',
          i18nKey: 'route.products_list',
        },
      },
      {
        name: 'products_create',
        path: '/products/create',
        component: 'view.products_form',
        meta: {
          title: '新建商品',
          i18nKey: 'route.products_create',
          hideInMenu: true,
        },
      },
      {
        name: 'products_edit',
        path: '/products/:id/edit',
        component: 'view.products_form',
        props: true,
        meta: {
          title: '编辑商品',
          i18nKey: 'route.products_edit',
          hideInMenu: true,
        },
      },
    ],
  },
  {
    name: 'orders',
    path: '/orders',
    component: 'layout.base',
    meta: {
      title: '订单管理',
      i18nKey: 'route.orders',
      icon: 'mdi:file-document',
      order: 3,
    },
    children: [
      {
        name: 'orders_list',
        path: '/orders/list',
        component: 'view.orders_list',
        meta: {
          title: '订单列表',
          i18nKey: 'route.orders_list',
        },
      },
      {
        name: 'orders_detail',
        path: '/orders/:id',
        component: 'view.orders_detail',
        props: true,
        meta: {
          title: '订单详情',
          i18nKey: 'route.orders_detail',
          hideInMenu: true,
        },
      },
    ],
  },
  {
    name: 'coupons',
    path: '/coupons',
    component: 'layout.base',
    meta: {
      title: '优惠券',
      i18nKey: 'route.coupons',
      icon: 'mdi:ticket',
      order: 4,
    },
    children: [
      {
        name: 'coupons_list',
        path: '/coupons/list',
        component: 'view.coupons_list',
        meta: {
          title: '优惠券列表',
          i18nKey: 'route.coupons_list',
        },
      },
    ],
  },
  {
    name: 'couponTemplates',
    path: '/coupon-templates',
    component: 'layout.base',
    meta: {
      title: '优惠券模板',
      i18nKey: 'route.couponTemplates',
      icon: 'mdi:ticket-percent',
      order: 4.2,
    },
    children: [
      {
        name: 'couponTemplates_list',
        path: '/coupon-templates/list',
        component: 'view.couponTemplates_list',
        meta: {
          title: '模板列表',
          i18nKey: 'route.couponTemplates_list',
        },
      },
      {
        name: 'couponTemplates_create',
        path: '/coupon-templates/create',
        component: 'view.couponTemplates_form',
        meta: {
          title: '新建模板',
          i18nKey: 'route.couponTemplates_create',
          hideInMenu: true,
        },
      },
      {
        name: 'couponTemplates_edit',
        path: '/coupon-templates/:id/edit',
        component: 'view.couponTemplates_form',
        props: true,
        meta: {
          title: '编辑模板',
          i18nKey: 'route.couponTemplates_edit',
          hideInMenu: true,
        },
      },
    ],
  },
  {
    name: 'memberTiers',
    path: '/member-tiers',
    component: 'layout.base',
    meta: {
      title: '会员等级',
      i18nKey: 'route.memberTiers',
      icon: 'mdi:account-star',
      order: 5.5,
    },
    children: [
      {
        name: 'memberTiers_list',
        path: '/member-tiers/list',
        component: 'view.memberTiers_list',
        meta: {
          title: '等级列表',
          i18nKey: 'route.memberTiers_list',
        },
      },
      {
        name: 'memberTiers_create',
        path: '/member-tiers/create',
        component: 'view.memberTiers_form',
        meta: {
          title: '新建等级',
          i18nKey: 'route.memberTiers_create',
          hideInMenu: true,
        },
      },
      {
        name: 'memberTiers_edit',
        path: '/member-tiers/:id/edit',
        component: 'view.memberTiers_form',
        props: true,
        meta: {
          title: '编辑等级',
          i18nKey: 'route.memberTiers_edit',
          hideInMenu: true,
        },
      },
    ],
  },
  {
    name: 'users',
    path: '/users',
    component: 'layout.base',
    meta: {
      title: '用户管理',
      i18nKey: 'route.users',
      icon: 'mdi:account-group',
      order: 5,
    },
    children: [
      {
        name: 'users_list',
        path: '/users/list',
        component: 'view.users_list',
        meta: {
          title: '用户列表',
          i18nKey: 'route.users_list',
        },
      },
    ],
  },
  {
    name: 'points',
    path: '/points',
    component: 'layout.base',
    meta: {
      title: '积分商城',
      i18nKey: 'route.points',
      icon: 'mdi:gift',
      order: 6,
    },
    children: [
      {
        name: 'points_list',
        path: '/points/list',
        component: 'view.points_list',
        meta: {
          title: '积分商品列表',
          i18nKey: 'route.points_list',
        },
      },
      {
        name: 'points_create',
        path: '/points/create',
        component: 'view.points_form',
        meta: {
          title: '新建积分商品',
          i18nKey: 'route.points_create',
          hideInMenu: true,
        },
      },
      {
        name: 'points_edit',
        path: '/points/:id/edit',
        component: 'view.points_form',
        props: true,
        meta: {
          title: '编辑积分商品',
          i18nKey: 'route.points_edit',
          hideInMenu: true,
        },
      },
    ],
  },
];

/** create routes when the auth route mode is static */
export function createStaticRoutes() {
  const constantRoutes: ElegantRoute[] = [];

  const authRoutes: ElegantRoute[] = [];

  // generatedRoutes first, customRoutes second — later routes override earlier ones for same name
  [...generatedRoutes, ...customRoutes].forEach(item => {
    if (item.meta?.constant) {
      constantRoutes.push(item);
    } else {
      authRoutes.push(item);
    }
  });

  return {
    constantRoutes,
    authRoutes
  };
}

/**
 * Get auth vue routes
 *
 * @param routes Elegant routes
 */
export function getAuthVueRoutes(routes: ElegantConstRoute[]) {
  return transformElegantRoutesToVueRoutes(routes, layouts, views);
}
