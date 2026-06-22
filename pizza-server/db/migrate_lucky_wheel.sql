-- 幸运转盘 (Lucky Wheel) — v1.2.0
-- Idempotent. Production MySQL: NO "ADD COLUMN IF NOT EXISTS"; use CREATE TABLE IF NOT EXISTS / plain MODIFY / INSERT IGNORE.

CREATE TABLE IF NOT EXISTS lucky_wheel_prizes (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  type ENUM('coupon','points','balance','thanks','again') NOT NULL,
  name VARCHAR(50) NOT NULL,
  weight INT UNSIGNED NOT NULL DEFAULT 1,
  stock INT UNSIGNED NULL,
  awarded_count INT UNSIGNED NOT NULL DEFAULT 0,
  coupon_template_id INT UNSIGNED NULL,
  points_amount INT UNSIGNED NULL,
  balance_amount DECIMAL(10,2) NULL,
  color VARCHAR(16) DEFAULT '#F5C518',
  icon VARCHAR(255) DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (coupon_template_id) REFERENCES coupon_templates(id) ON DELETE SET NULL,
  INDEX idx_active_sort (is_active, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lucky_wheel_draws (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  prize_id INT UNSIGNED NULL,
  prize_type ENUM('coupon','points','balance','thanks','again') NOT NULL,
  prize_name VARCHAR(50) NOT NULL,
  source ENUM('free','points','again') NOT NULL,
  cost_points INT UNSIGNED NOT NULL DEFAULT 0,
  coupon_id INT UNSIGNED NULL,
  points_amount INT UNSIGNED NULL,
  balance_amount DECIMAL(10,2) NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (prize_id) REFERENCES lucky_wheel_prizes(id) ON DELETE SET NULL,
  INDEX idx_user_date (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- balance_history.type currently ENUM('recharge','deduct','refund'); add 'reward' for lucky-wheel balance awards.
ALTER TABLE balance_history MODIFY COLUMN type ENUM('recharge','deduct','refund','reward') DEFAULT 'recharge';

INSERT IGNORE INTO system_config (config_key, config_value, description) VALUES
('lucky_enabled', '1', '幸运转盘开关(1开/0关)'),
('lucky_free_per_day', '1', '每日免费抽奖次数'),
('lucky_points_cost', '50', '免费次数用完后每次加抽消耗积分'),
('lucky_max_per_day', '10', '每日抽奖硬上限(含再来一次)');
