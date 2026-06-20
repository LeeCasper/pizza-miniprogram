-- 门店「自取须知」可后台配置:stores 增加 pickup_notice(多行文本,每行一条须知)。
-- /stores(小程序)与 /admin/settings/store(后台)均走 SELECT *,加列后自动透出,无需改查询。
-- 幂等:沿用本仓库迁移惯例——普通 ADD COLUMN;重复运行报 "Duplicate column" 被 deploy.py 当作无害 WARN。
-- (注意:生产 MySQL 不支持 ADD COLUMN IF NOT EXISTS,那是 MariaDB 扩展)
ALTER TABLE stores ADD COLUMN pickup_notice TEXT;
