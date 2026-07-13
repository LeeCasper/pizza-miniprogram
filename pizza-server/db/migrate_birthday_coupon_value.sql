ALTER TABLE member_tiers ADD COLUMN birthday_coupon_value DECIMAL(10,2) DEFAULT 0.00 COMMENT '生日券金额' AFTER coupon_value;
