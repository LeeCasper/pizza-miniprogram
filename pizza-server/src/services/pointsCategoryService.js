// src/services/pointsCategoryService.js — 积分商城分类
const pool = require('../config/database');

const pointsCategoryService = {
  /** Public: active categories */
  async findAll() {
    const [rows] = await pool.query(
      'SELECT * FROM points_categories WHERE is_active = 1 ORDER BY sort_order ASC, `key` ASC'
    );
    return rows;
  },

  /** Admin: all categories */
  async adminList() {
    const [rows] = await pool.query(
      'SELECT * FROM points_categories ORDER BY sort_order ASC, `key` ASC'
    );
    return rows;
  },

  async findByKey(key) {
    const [rows] = await pool.query('SELECT * FROM points_categories WHERE `key` = ?', [key]);
    return rows[0] || null;
  },

  async create({ key, name, icon = null, sortOrder = 0, isActive }) {
    await pool.query(
      'INSERT INTO points_categories (`key`, name, icon, sort_order, is_active) VALUES (?, ?, ?, ?, ?)',
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
    await pool.query(`UPDATE points_categories SET ${sets.join(', ')} WHERE \`key\` = ?`, params);
    return this.findByKey(key);
  },

  async countProducts(key) {
    const [rows] = await pool.query(
      'SELECT COUNT(*) AS cnt FROM points_products WHERE points_category_key = ?',
      [key]
    );
    return rows[0].cnt;
  },

  async remove(key) {
    await pool.query('UPDATE points_products SET points_category_key = NULL WHERE points_category_key = ?', [key]);
    await pool.query('DELETE FROM points_categories WHERE `key` = ?', [key]);
  },
};

module.exports = pointsCategoryService;
