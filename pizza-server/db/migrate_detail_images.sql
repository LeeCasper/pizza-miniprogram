-- Add detail_images column for separate product detail/description images
ALTER TABLE shop_products ADD COLUMN detail_images JSON DEFAULT NULL COMMENT '商品详情图URL数组' AFTER images;
