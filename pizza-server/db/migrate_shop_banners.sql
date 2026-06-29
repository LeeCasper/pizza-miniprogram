-- migrate_shop_banners.sql
-- 商城轮播图管理：scope 区分展示位置 + 扩展跳转类型 + 外链支持

ALTER TABLE banners
  ADD COLUMN scope ENUM('pos','shop','both') DEFAULT 'pos'
  AFTER link_product_id;

ALTER TABLE banners
  ADD COLUMN link_url VARCHAR(500) DEFAULT NULL
  AFTER link_product_id;

ALTER TABLE banners
  MODIFY link_type ENUM('product','none','coupon','points','lucky-wheel','url')
  DEFAULT 'none';

ALTER TABLE banners
  ADD INDEX idx_scope_active_sort (scope, is_active, sort_order);
