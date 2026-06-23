-- Add coupon template cover image + redeem product fields
-- Run: mysql -u root -p pizza < db/migrate_coupon_template_images.sql

ALTER TABLE coupon_templates
  ADD COLUMN image VARCHAR(500) DEFAULT '' COMMENT '模板封面图',
  ADD COLUMN redeem_product_name VARCHAR(100) DEFAULT '' COMMENT '兑换商品名称',
  ADD COLUMN redeem_product_price DECIMAL(10,2) NULL COMMENT '兑换商品价格',
  ADD COLUMN redeem_product_image VARCHAR(500) DEFAULT '' COMMENT '兑换商品图片';
