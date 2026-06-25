-- 会员商城 Phase 3：退款 + 确认收货
-- 1. shop_orders 新增退款相关列（幂等，通过存储过程检查 INFORMATION_SCHEMA）
-- 2. shop_refund_records 表（微信退款 API 调用状态追踪）

USE pizza;

-- ──────────────────────────────────────────────────────────
-- 1. shop_orders refund columns (idempotent via stored procedure)
-- ──────────────────────────────────────────────────────────
DROP PROCEDURE IF EXISTS _add_shop_refund_cols;
DELIMITER $$
CREATE PROCEDURE _add_shop_refund_cols()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'pizza' AND table_name = 'shop_orders' AND column_name = 'refund_amount'
  ) THEN
    ALTER TABLE shop_orders ADD COLUMN refund_amount DECIMAL(10,2) NULL COMMENT '退款金额' AFTER completed_at;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'pizza' AND table_name = 'shop_orders' AND column_name = 'refund_reason'
  ) THEN
    ALTER TABLE shop_orders ADD COLUMN refund_reason VARCHAR(200) NULL COMMENT '退款原因' AFTER refund_amount;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'pizza' AND table_name = 'shop_orders' AND column_name = 'refund_status'
  ) THEN
    ALTER TABLE shop_orders ADD COLUMN refund_status VARCHAR(20) NULL COMMENT '退款状态: processing/success/failed' AFTER refund_reason;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'pizza' AND table_name = 'shop_orders' AND column_name = 'refunded_at'
  ) THEN
    ALTER TABLE shop_orders ADD COLUMN refunded_at DATETIME NULL COMMENT '退款完成时间' AFTER refund_status;
  END IF;
END$$
DELIMITER ;
CALL _add_shop_refund_cols();
DROP PROCEDURE IF EXISTS _add_shop_refund_cols;

-- ──────────────────────────────────────────────────────────
-- 2. shop_refund_records table (idempotent)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shop_refund_records (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id VARCHAR(20) NOT NULL COMMENT '商城订单号 (SH+...)',
  user_id INT UNSIGNED NOT NULL,
  out_refund_no VARCHAR(64) NOT NULL UNIQUE COMMENT '商户退款单号 SR+orderId',
  refund_id VARCHAR(64) NULL COMMENT '微信退款单号',
  transaction_id VARCHAR(64) NULL COMMENT '原微信支付交易号',
  payment_method ENUM('wechat','balance') NOT NULL COMMENT '原支付方式',
  refund_amount DECIMAL(10,2) NOT NULL COMMENT '退款金额',
  reason VARCHAR(200) DEFAULT NULL COMMENT '退款原因',
  status ENUM('pending','processing','success','failed') DEFAULT 'pending' COMMENT '退款状态',
  points_reversed INT DEFAULT 0 COMMENT '已回退积分数',
  total_spent_reversed DECIMAL(10,2) DEFAULT 0 COMMENT '已回退累计消费额',
  raw_notify JSON NULL COMMENT '微信退款回调原始数据',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES shop_orders(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_sr_order (order_id),
  INDEX idx_sr_user (user_id),
  INDEX idx_sr_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
