-- Phase 0 Legal Blockers Migration
-- 1. refund_records table for tracking refunds
-- 2. users.deleted_at column for account soft-delete / anonymization

USE pizza;

-- ──────────────────────────────────────────────────────────
-- 1. Refund records table
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refund_records (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    order_id VARCHAR(20) NOT NULL COMMENT '原订单号',
    user_id INT UNSIGNED NOT NULL,
    out_refund_no VARCHAR(64) NOT NULL UNIQUE COMMENT '商户退款单号 R+orderId',
    refund_id VARCHAR(64) NULL COMMENT '微信退款单号',
    transaction_id VARCHAR(64) NULL COMMENT '原微信支付交易号',
    payment_method ENUM('wechat','balance') NOT NULL COMMENT '原支付方式',
    refund_amount DECIMAL(10,2) NOT NULL COMMENT '退款金额',
    reason VARCHAR(200) DEFAULT '用户取消订单',
    status ENUM('pending','processing','success','failed') DEFAULT 'pending',
    points_reversed INT DEFAULT 0 COMMENT '已回退积分数',
    coupon_restored TINYINT(1) DEFAULT 0 COMMENT '是否已恢复优惠券',
    raw_notify JSON NULL COMMENT '微信退款回调原始数据',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_order (order_id),
    INDEX idx_user (user_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ──────────────────────────────────────────────────────────
-- 2. users.deleted_at column (idempotent via stored procedure)
-- ──────────────────────────────────────────────────────────
DROP PROCEDURE IF EXISTS _add_deleted_at;
DELIMITER $$
CREATE PROCEDURE _add_deleted_at()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'pizza' AND table_name = 'users' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE users ADD COLUMN deleted_at DATETIME NULL DEFAULT NULL COMMENT '账号注销时间' AFTER updated_at;
    ALTER TABLE users ADD INDEX idx_deleted_at (deleted_at);
  END IF;
END$$
DELIMITER ;
CALL _add_deleted_at();
DROP PROCEDURE IF EXISTS _add_deleted_at;
