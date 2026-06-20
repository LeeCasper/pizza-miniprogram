-- 允许 products.category_key 为 NULL。
-- 删除分类时,该分类下仅剩的「软删商品」(is_deleted=1,对所有端已不可见)会通过外键
-- products_ibfk_1 阻止 DELETE(errno 1451)。改为可空后,categoryService.remove 先把这些软删
-- 商品的 category_key 置 NULL 解绑,再删分类;在售商品仍由应用层守卫阻止删除。
-- MODIFY 不改动既有外键/索引,且可重复运行(幂等,不报 Duplicate)。
ALTER TABLE products MODIFY category_key VARCHAR(30) NULL;
