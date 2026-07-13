ALTER TABLE member_tiers ADD COLUMN birthday_coupon2_value DECIMAL(10,2) DEFAULT 0.00 COMMENT '生日满减券面额' AFTER birthday_coupon_valid_days;
ALTER TABLE member_tiers ADD COLUMN birthday_coupon2_type VARCHAR(20) DEFAULT 'fixed_amount' COMMENT '生日满减券类型' AFTER birthday_coupon2_value;
ALTER TABLE member_tiers ADD COLUMN birthday_coupon2_min_spend DECIMAL(10,2) DEFAULT 0.00 COMMENT '生日满减券最低消费' AFTER birthday_coupon2_type;
ALTER TABLE member_tiers ADD COLUMN birthday_coupon2_valid_days INT DEFAULT 30 COMMENT '生日满减券有效天数' AFTER birthday_coupon2_min_spend;
