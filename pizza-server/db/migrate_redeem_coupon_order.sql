-- 兑换券下单：使用兑换券生成订单（支付方式显示「兑换券」）
-- 1. orders.payment_method 新增枚举值 'coupon'（NULL 仍表示未支付）
-- 2. order_items.product_id 放宽为可空，兼容无关联在售商品的快照型兑换券
-- 用 MODIFY COLUMN：生产 MySQL 重复执行同定义无害，无需 IF NOT EXISTS

ALTER TABLE orders
  MODIFY COLUMN payment_method ENUM('wechat','balance','coupon') NULL COMMENT '支付方式(NULL=未支付)';

ALTER TABLE order_items
  MODIFY COLUMN product_id INT UNSIGNED NULL;
