-- Backfill existing redeem coupons with product info from their template's linked product
-- For coupons whose template has product_id set but the coupon has empty redeem_product_name

UPDATE coupons c
JOIN coupon_templates t ON c.template_id = t.id
JOIN products p ON t.product_id = p.id AND p.is_deleted = 0
SET
  c.redeem_product_name = p.name,
  c.redeem_product_price = p.price,
  c.redeem_product_image = COALESCE(p.image, '')
WHERE c.category = 'redeem'
  AND (c.redeem_product_name IS NULL OR c.redeem_product_name = '')
  AND t.product_id IS NOT NULL;
