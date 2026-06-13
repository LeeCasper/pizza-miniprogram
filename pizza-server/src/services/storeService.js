const pool = require('../config/database');

const storeService = {
  async findAll() {
    const [rows] = await pool.query('SELECT * FROM stores WHERE is_active = 1');
    return rows;
  },

  async findById(id) {
    const [rows] = await pool.query('SELECT * FROM stores WHERE id = ? AND is_active = 1', [id]);
    return rows[0] || null;
  },
};

module.exports = storeService;
