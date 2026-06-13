const pool = require('../config/database');

const categoryService = {
  async findAll() {
    const [rows] = await pool.query(
      'SELECT * FROM categories WHERE is_active = 1 ORDER BY sort_order ASC'
    );
    return rows;
  },
};

module.exports = categoryService;
