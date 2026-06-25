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
  {
    name: 'settings',
    path: '/settings',
    component: 'layout.base',
    meta: {
      title: '系统设置',
      i18nKey: 'route.settings',
      icon: 'mdi:cog',
      order: 8,
    },
    children: [
      {
        name: 'settings_pay',
        path: '/settings/pay',
        component: 'view.settings_pay',
        meta: {
          title: '支付配置',
          i18nKey: 'route.settings_pay',
        },
      },
      {
        name: 'settings_printer',
        path: '/settings/printer',
        component: 'view.settings_printer',
        meta: {
          title: '打印机配置',
          i18nKey: 'route.settings_printer',
        },
      },
      {
        name: 'settings_map',
        path: '/settings/map',
        component: 'view.settings_map',
        meta: {
          title: '地图配置',
          i18nKey: 'route.settings_map',
        },
      },
      {
        name: 'settings_store',
        path: '/settings/store',
        component: 'view.settings_store',
        meta: {
          title: '门店设置',
          i18nKey: 'route.settings_store',
        },
      },
      {
        name: 'settings_business',
        path: '/settings/business',
        component: 'view.settings_business',
        meta: {
          title: '业务配置',
          i18nKey: 'route.settings_business',
        },
      },
    ],
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
        name: 'products_categories',
        path: '/products/categories',
        component: 'view.products_categories',
        meta: {
          title: '商品分类',
          i18nKey: 'route.products_categories',
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
    name: 'shop',
    path: '/shop',
    component: 'layout.base',
    meta: {
      title: '会员商城',
      i18nKey: 'route.shop',
      icon: 'mdi:storefront',
      order: 2.5,
    },
    children: [
      {
        name: 'shop_products_list',
        path: '/shop/products',
        component: 'view.shop_products_list',
        meta: {
          title: '商城商品',
          i18nKey: 'route.shop_products_list',
        },
      },
      {
        name: 'shop_categories',
        path: '/shop/categories',
        component: 'view.shop_categories',
        meta: {
          title: '商城分类',
          i18nKey: 'route.shop_categories',
        },
      },
      {
        name: 'shop_products_create',
        path: '/shop/products/create',
        component: 'view.shop_products_form',
        meta: {
          title: '新建商品',
          i18nKey: 'route.shop_products_create',
          hideInMenu: true,
        },
      },
      {
        name: 'shop_products_edit',
        path: '/shop/products/:id/edit',
        component: 'view.shop_products_form',
        props: true,
        meta: {
          title: '编辑商品',
          i18nKey: 'route.shop_products_edit',
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
    name: 'payments',
    path: '/payments',
    component: 'layout.base$view.payments_list',
    meta: {
      title: '交易记录',
      i18nKey: 'route.payments',
      icon: 'mdi:cash-register',
      order: 3.5,
    },
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
      {
        name: 'coupons_templates',
        path: '/coupons/templates',
        component: 'layout.base',
        meta: {
          title: '优惠券模板',
          i18nKey: 'route.coupons_templates',
          icon: 'mdi:ticket-percent',
        },
        children: [
          {
            name: 'coupons_templates_list',
            path: '/coupons/templates/list',
            component: 'view.coupons_templates_list',
            meta: {
              title: '模板列表',
              i18nKey: 'route.coupons_templates_list',
            },
          },
          {
            name: 'coupons_templates_create',
            path: '/coupons/templates/create',
            component: 'view.coupons_templates_form',
            meta: {
              title: '新建模板',
              i18nKey: 'route.coupons_templates_create',
              hideInMenu: true,
            },
          },
          {
            name: 'coupons_templates_edit',
            path: '/coupons/templates/:id/edit',
            component: 'view.coupons_templates_form',
            props: true,
            meta: {
              title: '编辑模板',
              i18nKey: 'route.coupons_templates_edit',
              hideInMenu: true,
            },
          },
        ],
      },
    ],
  },
  {
    name: 'luckywheel',
    path: '/lucky-wheel',
    component: 'layout.base',
    meta: {
      title: '幸运转盘',
      i18nKey: 'route.luckywheel',
      icon: 'mdi:dharmachakra',
      order: 6.5,
    },
    children: [
      {
        name: 'luckywheel_prizes_list',
        path: '/lucky-wheel/prizes',
        component: 'view.luckywheel_prizes_list',
        meta: {
          title: '奖品管理',
          i18nKey: 'route.luckywheel_prizes_list',
        },
      },
      {
        name: 'luckywheel_prizes_create',
        path: '/lucky-wheel/prizes/create',
        component: 'view.luckywheel_prizes_form',
        meta: {
          title: '新建奖品',
          i18nKey: 'route.luckywheel_prizes_create',
          hideInMenu: true,
        },
      },
      {
        name: 'luckywheel_prizes_edit',
        path: '/lucky-wheel/prizes/:id/edit',
        component: 'view.luckywheel_prizes_form',
        props: true,
        meta: {
          title: '编辑奖品',
          i18nKey: 'route.luckywheel_prizes_edit',
          hideInMenu: true,
        },
      },
      {
        name: 'luckywheel_records_list',
        path: '/lucky-wheel/records',
        component: 'view.luckywheel_records_list',
        meta: {
          title: '抽奖记录',
          i18nKey: 'route.luckywheel_records_list',
        },
      },
    ],
  },
  {
    name: 'membertiers',
    path: '/member-tiers',
    component: 'layout.base',
    meta: {
      title: '会员等级',
      i18nKey: 'route.membertiers',
      icon: 'mdi:account-star',
      order: 5.5,
    },
    children: [
      {
        name: 'membertiers_list',
        path: '/member-tiers/list',
        component: 'view.membertiers_list',
        meta: {
          title: '等级列表',
          i18nKey: 'route.membertiers_list',
        },
      },
      {
        name: 'membertiers_create',
        path: '/member-tiers/create',
        component: 'view.membertiers_form',
        meta: {
          title: '新建等级',
          i18nKey: 'route.membertiers_create',
          hideInMenu: true,
        },
      },
      {
        name: 'membertiers_edit',
        path: '/member-tiers/:id/edit',
        component: 'view.membertiers_form',
        props: true,
        meta: {
          title: '编辑等级',
          i18nKey: 'route.membertiers_edit',
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
