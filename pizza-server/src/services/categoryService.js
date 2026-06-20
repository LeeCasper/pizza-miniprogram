const pool = require('../config/database');

const categoryService = {
  // 公开端:仅启用的分类(小程序点单页用)
  async findAll() {
    const [rows] = await pool.query(
      'SELECT * FROM categories WHERE is_active = 1 ORDER BY sort_order ASC, id ASC'
    );
    return rows;
  },

  // 后台:全部分类(含未启用)
  async adminList() {
    const [rows] = await pool.query(
      'SELECT * FROM categories ORDER BY sort_order ASC, id ASC'
    );
    return rows;
  },

  async findByKey(key) {
    const [rows] = await pool.query('SELECT * FROM categories WHERE `key` = ?', [key]);
    return rows[0] || null;
  },

  async create({ key, name, icon, sortOrder, isActive }) {
    await pool.query(
      'INSERT INTO categories (`key`, name, icon, sort_order, is_active) VALUES (?, ?, ?, ?, ?)',
      [key, name, icon || '', sortOrder || 0, isActive === undefined ? 1 : isActive ? 1 : 0]
    );
    return this.findByKey(key);
  },

  // 仅改 name/icon/sort_order/is_active —— 不改 key(key 是 products.category_key 外键目标)
  async update(key, data) {
    const fields = { name: 'name', icon: 'icon', sortOrder: 'sort_order', isActive: 'is_active' };
    const sets = [];
    const values = [];
    for (const [k, col] of Object.entries(fields)) {
      if (data[k] !== undefined) {
        sets.push(`${col} = ?`);
        values.push(col === 'is_active' ? (data[k] ? 1 : 0) : data[k]);
      }
    }
    if (sets.length === 0) return this.findByKey(key);
    values.push(key);
    await pool.query('UPDATE categories SET ' + sets.join(', ') + ' WHERE `key` = ?', values);
    return this.findByKey(key);
  },

  // 该分类下未删除的商品数(删除分类前的守卫)
  async countProducts(key) {
    const [rows] = await pool.query(
      'SELECT COUNT(*) AS cnt FROM products WHERE category_key = ? AND is_deleted = 0',
      [key]
    );
    return rows[0].cnt;
  },

  async remove(key) {
    // 软删商品(is_deleted=1)仍通过外键引用本分类,会让 DELETE 触发 errno 1451。
    // 它们已对后台/小程序全部不可见,分类归属对其无意义 → 先解绑(category_key 置 NULL)再删分类。
    // 在售商品(is_deleted=0)由控制器守卫先行拦截,不会走到这里。
    await pool.query('UPDATE products SET category_key = NULL WHERE category_key = ? AND is_deleted = 1', [key]);
    await pool.query('DELETE FROM categories WHERE `key` = ?', [key]);
  },
};

module.exports = categoryService;
