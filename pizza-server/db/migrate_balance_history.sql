-- Migration: Create balance_history table
-- v1.8.3 — required for balance recharge sync
CREATE TABLE IF NOT EXISTS balance_history (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    amount DECIMAL(10,2) NOT NULL COMMENT '充值/扣款金额',
    balance_after DECIMAL(10,2) NOT NULL COMMENT '操作后余额',
    type ENUM('recharge','deduct','refund') DEFAULT 'recharge',
    remark VARCHAR(128) DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user (user_id),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
