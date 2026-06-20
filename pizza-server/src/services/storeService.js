const pool = require('../config/database');

/**
 * mysql2 returns DECIMAL(10,7) as strings (e.g. "32.9618570").
 * Convert to JS number so map components work correctly.
 */
function formatStore(row) {
  if (!row) return null;
  return {
    ...row,
    latitude: row.latitude != null ? parseFloat(row.latitude) : null,
    longitude: row.longitude != null ? parseFloat(row.longitude) : null,
  };
}

const storeService = {
  async findAll() {
    const [rows] = await pool.query('SELECT * FROM stores WHERE is_active = 1');
    return rows.map(formatStore);
  },

  async findById(id) {
    const [rows] = await pool.query('SELECT * FROM stores WHERE id = ? AND is_active = 1', [id]);
    return formatStore(rows[0] || null);
  },

  /**
   * Update store fields (whitelist approach)
   * @param {number} id
   * @param {object} data — { name, address, phone, latitude, longitude, business_hours, image, desc, pickup_notice }
   */
  async update(id, data) {
    const allowedFields = ['name', 'address', 'phone', 'latitude', 'longitude', 'business_hours', 'image', 'desc', 'pickup_notice'];
    const sets = [];
    const values = [];

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        sets.push(`\`${field}\` = ?`);
        values.push(data[field]);
      }
    }

    if (sets.length === 0) return;

    values.push(id);
    await pool.query(
      `UPDATE stores SET ${sets.join(', ')} WHERE id = ?`,
      values
    );
  },
};

module.exports = storeService;
