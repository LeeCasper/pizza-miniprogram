const pool = require('../config/database');

const productService = {
  async findAll(category) {
    let sql = 'SELECT * FROM products WHERE is_available = 1';
    const params = [];
    if (category && category !== 'all') {
      sql += ' AND category_key = ?';
      params.push(category);
    }
    sql += ' ORDER BY sort_order ASC, id ASC';
    const [rows] = await pool.query(sql, params);
    return rows.map(formatProduct);
  },

  async findById(id) {
    const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [id]);
    return rows[0] ? formatProduct(rows[0]) : null;
  },

  // Admin methods
  async adminList() {
    const [rows] = await pool.query('SELECT * FROM products ORDER BY sort_order ASC, id ASC');
    return rows.map(formatProduct);
  },

  async create(data) {
    const { category_key, name, desc, detail_desc, price, image, tag, size_desc, ingredients } = data;
    const [result] = await pool.query(
      `INSERT INTO products (category_key, name, \`desc\`, detail_desc, price, image, tag, size_desc, ingredients)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [category_key, name, desc || '', detail_desc || '', price, image || '', tag || '', size_desc || '',
       ingredients ? JSON.stringify(ingredients) : null]
    );
    return this.findById(result.insertId);
  },

  async update(id, data) {
    const fields = ['category_key', 'name', 'desc', 'detail_desc', 'price', 'image', 'tag', 'size_desc', 'is_available'];
    const sets = [];
    const values = [];
    for (const f of fields) {
      if (data[f] !== undefined) {
        sets.push(`\`${f}\` = ?`);
        values.push(f === 'ingredients' ? null : data[f]);
      }
    }
    if (data.ingredients !== undefined) {
      sets.push('ingredients = ?');
      values.push(JSON.stringify(data.ingredients));
    }
    if (sets.length === 0) return this.findById(id);
    sets.push('updated_at = NOW()');
    values.push(id);
    await pool.query(`UPDATE products SET ${sets.join(', ')} WHERE id = ?`, values);
    return this.findById(id);
  },

  async softDelete(id) {
    await pool.query('UPDATE products SET is_available = 0 WHERE id = ?', [id]);
  },

  async toggle(id) {
    await pool.query('UPDATE products SET is_available = IF(is_available, 0, 1) WHERE id = ?', [id]);
    return this.findById(id);
  },
};

function formatProduct(row) {
  if (!row) return null;
  return {
    ...row,
    ingredients: safeJson(row.ingredients, []),
  };
}

function safeJson(val, defaultVal) {
  if (!val) return defaultVal;
  try { return typeof val === 'string' ? JSON.parse(val) : val; }
  catch (_) { return defaultVal; }
}

module.exports = productService;
