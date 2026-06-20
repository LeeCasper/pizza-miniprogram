-- 商品软删除:与「上架/下架」(is_available) 解耦的真删除标记
-- 删除按钮 = is_deleted=1(从后台列表与小程序消失),保留订单历史外键完好(order_items.product_id 无 CASCADE)
-- 幂等:沿用本仓库迁移惯例——普通 ADD COLUMN;重复运行报 "Duplicate column" 被 deploy.py 当作无害 WARN
-- (注意:生产 MySQL 不支持 ADD COLUMN IF NOT EXISTS,那是 MariaDB 扩展)
ALTER TABLE products ADD COLUMN is_deleted TINYINT(1) NOT NULL DEFAULT 0;
