-- 商品软删除:与「上架/下架」(is_available) 解耦的真删除标记
-- 删除按钮 = is_deleted=1(从后台列表与小程序消失),保留订单历史外键完好(order_items.product_id 无 CASCADE)
-- 幂等:MySQL 8 支持 ADD COLUMN IF NOT EXISTS;重复运行产生无害告警
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_deleted TINYINT(1) NOT NULL DEFAULT 0;
