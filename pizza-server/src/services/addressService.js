const pool = require('../config/database');

const addressService = {
  async findByUser(userId) {
    const [rows] = await pool.query(
      'SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC',
      [userId]
    );
    return rows.map(formatAddress);
  },

  async findById(id, userId) {
    const [rows] = await pool.query(
      'SELECT * FROM addresses WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    return rows[0] ? formatAddress(rows[0]) : null;
  },

  async create(userId, data) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Reset default if this is the new default
      if (data.isDefault) {
        await conn.query('UPDATE addresses SET is_default = 0 WHERE user_id = ?', [userId]);
      }

      const [result] = await conn.query(
        `INSERT INTO addresses (user_id, name, phone, province, city, district, detail, tag, is_default)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, data.name, data.phone, data.province, data.city, data.district,
         data.detail, data.tag || '', data.isDefault ? 1 : 0]
      );

      await conn.commit();
      return formatAddress({ ...data, id: result.insertId, user_id: userId, is_default: data.isDefault ? 1 : 0 });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  async update(id, userId, data) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      if (data.isDefault) {
        await conn.query('UPDATE addresses SET is_default = 0 WHERE user_id = ?', [userId]);
      }

      await conn.query(
        `UPDATE addresses SET name=?, phone=?, province=?, city=?, district=?, detail=?, tag=?, is_default=?, updated_at=NOW()
         WHERE id = ? AND user_id = ?`,
        [data.name, data.phone, data.province, data.city, data.district,
         data.detail, data.tag || '', data.isDefault ? 1 : 0, id, userId]
      );

      await conn.commit();
      return this.findById(id, userId);
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  async delete(id, userId) {
    const addr = await this.findById(id, userId);
    if (!addr) return null;

    await pool.query('DELETE FROM addresses WHERE id = ? AND user_id = ?', [id, userId]);

    // If deleted was default, promote the first remaining address
    if (addr.isDefault) {
      const [remaining] = await pool.query(
        'SELECT id FROM addresses WHERE user_id = ? ORDER BY created_at ASC LIMIT 1',
        [userId]
      );
      if (remaining.length > 0) {
        await pool.query('UPDATE addresses SET is_default = 1 WHERE id = ?', [remaining[0].id]);
      }
    }

    return addr;
  },
};

function formatAddress(row) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    region: [row.province, row.city, row.district],
    province: row.province,
    city: row.city,
    district: row.district,
    detail: row.detail,
    tag: row.tag,
    isDefault: !!row.is_default,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

module.exports = addressService;
