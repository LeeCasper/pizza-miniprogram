// src/services/shopProductService.js — 会员商城商品
const pool = require('../config/database');

const shopProductService = {
  // 公开：上架且未删；userId 存在时 LEFT JOIN 收藏表标记 is_favorited
  async findAll(category, userId) {
    const params = [];
    let favSelect = '0 AS is_favorited';
    let favJoin = '';
    if (userId) {
      favSelect = 'CASE WHEN f.id IS NULL THEN 0 ELSE 1 END AS is_favorited';
      favJoin = 'LEFT JOIN shop_favorites f ON f.shop_product_id = p.id AND f.user_id = ?';
      params.push(userId);
    }
    let sql = `SELECT p.*, ${favSelect} FROM shop_products p ${favJoin}
      WHERE p.is_available = 1 AND p.is_deleted = 0`;
    if (category && category !== 'all') {
      sql += ' AND p.shop_category_key = ?';
      params.push(category);
    }
    sql += ' ORDER BY p.sort_order ASC, p.id ASC';
    const [rows] = await pool.query(sql, params);
    return rows.map(formatShopProduct);
  },

  async findById(id, userId) {
    const params = [];
    let favSelect = '0 AS is_favorited';
    let favJoin = '';
    if (userId) {
      favSelect = 'CASE WHEN f.id IS NULL THEN 0 ELSE 1 END AS is_favorited';
      favJoin = 'LEFT JOIN shop_favorites f ON f.shop_product_id = p.id AND f.user_id = ?';
      params.push(userId);
    }
    params.push(id);
    const [rows] = await pool.query(
      `SELECT p.*, ${favSelect} FROM shop_products p ${favJoin}
       WHERE p.id = ? AND p.is_deleted = 0`,
      params
    );
    return rows[0] ? formatShopProduct(rows[0]) : null;
  },

  async adminList() {
    const [rows] = await pool.query(
      'SELECT * FROM shop_products WHERE is_deleted = 0 ORDER BY sort_order ASC, id ASC'
    );
    return rows.map(formatShopProduct);
  },

  async adminFindById(id) {
    const [rows] = await pool.query('SELECT * FROM shop_products WHERE id = ?', [id]);
    return rows[0] ? formatShopProduct(rows[0]) : null;
  },

  async create(data) {
    const {
      shop_category_key = null, name, subtitle = null, price,
      original_price = null, main_image = null, images = [],
      detail_desc = null, stock = 0, tag = null,
      is_available = 1, sort_order = 0,
    } = data;
    const [result] = await pool.query(
      `INSERT INTO shop_products
       (shop_category_key, name, subtitle, price, original_price, main_image, images, detail_desc, stock, tag, is_available, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [shop_category_key, name, subtitle, price, original_price, main_image,
       JSON.stringify(Array.isArray(images) ? images : []), detail_desc, stock, tag,
       is_available ? 1 : 0, sort_order]
    );
    return this.adminFindById(result.insertId);
  },

  async update(id, data) {
    const fieldMap = {
      shop_category_key: 'shop_category_key',
      name: 'name',
      subtitle: 'subtitle',
      price: 'price',
      original_price: 'original_price',
      main_image: 'main_image',
      detail_desc: 'detail_desc',
      stock: 'stock',
      tag: 'tag',
      sort_order: 'sort_order',
    };
    const sets = [];
    const params = [];
    for (const [key, col] of Object.entries(fieldMap)) {
      if (data[key] !== undefined) {
        sets.push(`\`${col}\` = ?`);
        params.push(data[key]);
      }
    }
    if (data.is_available !== undefined) {
      sets.push('is_available = ?');
      params.push(data.is_available ? 1 : 0);
    }
    if (data.images !== undefined) {
      sets.push('images = ?');
      params.push(JSON.stringify(Array.isArray(data.images) ? data.images : []));
    }
    if (sets.length === 0) return this.adminFindById(id);
    sets.push('updated_at = NOW()');
    params.push(id);
    await pool.query(`UPDATE shop_products SET ${sets.join(', ')} WHERE id = ?`, params);
    return this.adminFindById(id);
  },

  async softDelete(id) {
    await pool.query('UPDATE shop_products SET is_deleted = 1 WHERE id = ?', [id]);
  },

  async toggle(id) {
    await pool.query('UPDATE shop_products SET is_available = IF(is_available, 0, 1) WHERE id = ?', [id]);
    return this.adminFindById(id);
  },
};

function formatShopProduct(row) {
  if (!row) return null;
  const { is_favorited, ...rest } = row;
  return {
    ...rest,
    images: safeJson(row.images, []),
    isFavorited: !!is_favorited,
  };
}

function safeJson(val, d) {
  if (!val) return d;
  try { return typeof val === 'string' ? JSON.parse(val) : val; } catch (_) { return d; }
}

module.exports = shopProductService;
