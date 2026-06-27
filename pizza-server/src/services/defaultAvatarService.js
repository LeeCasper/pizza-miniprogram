const pool = require('../config/database');

const defaultAvatarService = {
  /** List all default avatars, ordered by sort_order */
  async list() {
    const [rows] = await pool.query(
      'SELECT id, url, sort_order, created_at FROM default_avatars ORDER BY sort_order, id'
    );
    return rows;
  },

  /** Add a new default avatar URL */
  async create(url) {
    const [result] = await pool.query(
      'INSERT INTO default_avatars (url) VALUES (?)',
      [url]
    );
    return { id: result.insertId, url };
  },

  /** Delete a default avatar by id */
  async delete(id) {
    await pool.query('DELETE FROM default_avatars WHERE id = ?', [id]);
  },

  /** Get count of current avatars */
  async count() {
    const [[{ cnt }]] = await pool.query(
      'SELECT COUNT(*) AS cnt FROM default_avatars'
    );
    return cnt;
  },

  /**
   * Pick a random default avatar URL.
   * Returns null if the table is empty.
   */
  async getRandom() {
    const [rows] = await pool.query(
      'SELECT url FROM default_avatars ORDER BY RAND() LIMIT 1'
    );
    return rows.length ? rows[0].url : null;
  },
};

module.exports = defaultAvatarService;
