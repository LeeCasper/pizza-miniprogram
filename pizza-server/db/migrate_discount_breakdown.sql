ALTER TABLE orders ADD COLUMN coupon_discount DECIMAL(10,2) DEFAULT 0.00 AFTER discount_amount;
ALTER TABLE orders ADD COLUMN tier_discount DECIMAL(10,2) DEFAULT 0.00 AFTER coupon_discount;
