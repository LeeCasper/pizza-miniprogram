// src/services/shopCategoryService.js — 会员商城分类
const pool = require('../config/database');

const shopCategoryService = {
  async findAll() {
    const [rows] = await pool.query(
      'SELECT * FROM shop_categories WHERE is_active = 1 ORDER BY sort_order ASC, `key` ASC'
    );
    return rows;
  },

  async adminList() {
    const [rows] = await pool.query(
      'SELECT * FROM shop_categories ORDER BY sort_order ASC, `key` ASC'
    );
    return rows;
  },

  async findByKey(key) {
    const [rows] = await pool.query('SELECT * FROM shop_categories WHERE `key` = ?', [key]);
    return rows[0] || null;
  },

  async create({ key, name, icon = null, sortOrder = 0, isActive }) {
    await pool.query(
      'INSERT INTO shop_categories (`key`, name, icon, sort_order, is_active) VALUES (?, ?, ?, ?, ?)',
      [key, name, icon, sortOrder, isActive === undefined ? 1 : isActive ? 1 : 0]
    );
    return this.findByKey(key);
  },

  async update(key, data) {
    const fieldMap = { name: 'name', icon: 'icon', sortOrder: 'sort_order', isActive: 'is_active' };
    const sets = [];
    const params = [];
    for (const [k, col] of Object.entries(fieldMap)) {
      if (data[k] !== undefined) {
        if (col === 'is_active') {
          sets.push('is_active = ?');
          params.push(data[k] ? 1 : 0);
        } else {
          sets.push(`\`${col}\` = ?`);
          params.push(data[k]);
        }
      }
    }
    if (sets.length === 0) return this.findByKey(key);
    sets.push('updated_at = NOW()');
    params.push(key);
    await pool.query(`UPDATE shop_categories SET ${sets.join(', ')} WHERE \`key\` = ?`, params);
    return this.findByKey(key);
  },

  async countProducts(key) {
    const [rows] = await pool.query(
      'SELECT COUNT(*) AS cnt FROM shop_products WHERE shop_category_key = ? AND is_deleted = 0',
      [key]
    );
    return rows[0].cnt;
  },

  async remove(key) {
    // 解绑已软删商品的引用（避免外键约束阻塞），再删分类
    await pool.query(
      'UPDATE shop_products SET shop_category_key = NULL WHERE shop_category_key = ? AND is_deleted = 1',
      [key]
    );
    await pool.query('DELETE FROM shop_categories WHERE `key` = ?', [key]);
  },
};

module.exports = shopCategoryService;
