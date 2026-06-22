-- 优惠券系统完善：模板领取规则 + 百分比折扣 + 领取记录表
-- 生产 MySQL 不支持 ADD COLUMN IF NOT EXISTS，用普通 ADD COLUMN（重复执行产生无害 Duplicate column 警告）

ALTER TABLE coupon_templates
  ADD COLUMN claimable        TINYINT(1)    NOT NULL DEFAULT 0,
  ADD COLUMN total_stock      INT UNSIGNED  NULL,
  ADD COLUMN claimed_count    INT UNSIGNED  NOT NULL DEFAULT 0,
  ADD COLUMN per_user_limit   INT UNSIGNED  NOT NULL DEFAULT 1,
  ADD COLUMN claim_period     ENUM('none','weekly','monthly') NOT NULL DEFAULT 'none',
  ADD COLUMN min_member_level INT           NOT NULL DEFAULT 0,
  ADD COLUMN max_discount     DECIMAL(10,2) NULL;

ALTER TABLE coupon_templates
  MODIFY COLUMN discount_type ENUM('free_redeem','buy_one_get_one','free_delivery','half_price','fixed_amount','percentage') DEFAULT 'fixed_amount';

ALTER TABLE coupons
  ADD COLUMN template_id  INT UNSIGNED  NULL,
  ADD COLUMN max_discount DECIMAL(10,2) NULL;

ALTER TABLE coupons
  MODIFY COLUMN discount_type ENUM('free_redeem','buy_one_get_one','free_delivery','half_price','fixed_amount','percentage') NULL;

CREATE TABLE IF NOT EXISTS coupon_claims (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    template_id INT UNSIGNED NOT NULL,
    user_id     INT UNSIGNED NOT NULL,
    coupon_id   INT UNSIGNED NOT NULL,
    period_key  VARCHAR(16)  NOT NULL DEFAULT '',
    claimed_at  DATETIME     DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (template_id) REFERENCES coupon_templates(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)     REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_tpl_user_period (template_id, user_id, period_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
