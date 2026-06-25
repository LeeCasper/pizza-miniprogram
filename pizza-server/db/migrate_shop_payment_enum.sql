-- 会员商城 Phase 2：payment_records 类型扩展（shop_order）
-- 幂等：MODIFY COLUMN 重复执行无害
ALTER TABLE payment_records MODIFY COLUMN type ENUM('order','recharge','shop_order') NOT NULL COMMENT '支付类型';
