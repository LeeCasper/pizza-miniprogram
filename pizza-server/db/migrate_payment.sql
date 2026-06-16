-- =============================================
-- Payment Migration — v1.6.0+
-- Run: mysql -u root -p pizza < db/migrate_payment.sql
-- =============================================

-- 1. Add payment columns to orders
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_method ENUM('wechat','balance') NULL COMMENT '支付方式(NULL=未支付)',
  ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(64) NULL COMMENT '微信支付交易号',
  ADD COLUMN IF NOT EXISTS paid_at DATETIME NULL COMMENT '支付完成时间';

-- 2. Create payment_records table
CREATE TABLE IF NOT EXISTS payment_records (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    type ENUM('order','recharge') NOT NULL COMMENT '支付类型',
    reference_id VARCHAR(64) NOT NULL COMMENT '关联ID(订单号/充值流水号)',
    out_trade_no VARCHAR(64) NOT NULL UNIQUE COMMENT '商户订单号',
    transaction_id VARCHAR(64) NULL COMMENT '微信支付交易号',
    amount DECIMAL(10,2) NOT NULL,
    status ENUM('pending','success','failed','closed') DEFAULT 'pending',
    raw_notify JSON NULL COMMENT '微信回调原始数据',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_user (user_id),
    INDEX idx_out_trade_no (out_trade_no),
    INDEX idx_reference (reference_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Create system_config table
CREATE TABLE IF NOT EXISTS system_config (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    config_key VARCHAR(64) NOT NULL UNIQUE,
    config_value TEXT NOT NULL,
    description VARCHAR(255) DEFAULT '',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Seed payment config keys (INSERT IGNORE to avoid duplicates)
INSERT IGNORE INTO system_config (config_key, config_value, description) VALUES
('wx_pay_mch_id', '', '微信支付商户号'),
('wx_pay_api_v3_key', '', 'API v3密钥(32位)'),
('wx_pay_cert_serial_no', '', '商户证书序列号'),
('wx_pay_private_key', '', '商户私钥(PEM格式)'),
('wx_pay_platform_cert', '', '微信支付平台证书(PEM格式)'),
('wx_pay_notify_url', 'https://artaides.com/api/v1/pay/notify', '支付回调通知URL');
