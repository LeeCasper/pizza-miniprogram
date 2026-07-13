ALTER TABLE member_tiers ADD COLUMN birthday_coupon_type VARCHAR(20) DEFAULT 'fixed_amount' COMMENT '生日券类型: fixed_amount/percentage' AFTER birthday_coupon_value;
ALTER TABLE member_tiers ADD COLUMN birthday_coupon_min_spend DECIMAL(10,2) DEFAULT 0.00 COMMENT '生日券最低消费门槛' AFTER birthday_coupon_type;
ALTER TABLE member_tiers ADD COLUMN birthday_coupon_valid_days INT DEFAULT 30 COMMENT '生日券有效天数' AFTER birthday_coupon_min_spend;
