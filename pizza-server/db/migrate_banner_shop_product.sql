-- migrate_banner_shop_product.sql
-- 商城 banner 商品链接：link_product_id 指向 POS 商品，新增 link_shop_product_id 指向商城商品

ALTER TABLE banners
  ADD COLUMN link_shop_product_id INT UNSIGNED NULL
  AFTER link_product_id;
