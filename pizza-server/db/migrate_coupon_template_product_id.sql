ALTER TABLE coupon_templates
  ADD COLUMN product_id INT UNSIGNED NULL COMMENT '关联商品ID(兑换券可关联商品自动填充信息)';
