const pool = require('../config/database');

const userService = {
  async findByOpenid(openid) {
    const [rows] = await pool.query('SELECT * FROM users WHERE openid = ?', [openid]);
    return rows[0] || null;
  },

  async findById(id) {
    const [rows] = await pool.query(
      'SELECT id, openid, name, avatar, bio, phone, points, balance, member_level, notification_enabled, role, created_at, updated_at FROM users WHERE id = ?',
      [id]
    );
    return rows[0] || null;
  },

  async create({ openid, unionid, sessionKey }) {
    const [result] = await pool.query(
      'INSERT INTO users (openid, unionid, session_key) VALUES (?, ?, ?)',
      [openid, unionid || null, sessionKey || null]
    );
    return this.findById(result.insertId);
  },

  async updateSession(id, sessionKey) {
    await pool.query('UPDATE users SET session_key = ? WHERE id = ?', [sessionKey, id]);
  },

  async updateProfile(id, { name, bio }) {
    const sets = [];
    const values = [];
    if (name !== undefined) { sets.push('name = ?'); values.push(name); }
    if (bio !== undefined) { sets.push('bio = ?'); values.push(bio); }
    if (sets.length === 0) return this.findById(id);
    values.push(id);
    await pool.query(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, values);
    return this.findById(id);
  },

  async updateAvatar(id, avatar) {
    await pool.query('UPDATE users SET avatar = ? WHERE id = ?', [avatar, id]);
    return this.findById(id);
  },

  async updatePoints(id, points, memberLevel) {
    await pool.query(
      'UPDATE users SET points = ?, member_level = ? WHERE id = ?',
      [points, memberLevel, id]
    );
  },

  async updateSettings(id, { notificationEnabled, phone }) {
    const sets = [];
    const values = [];
    if (notificationEnabled !== undefined) {
      sets.push('notification_enabled = ?');
      values.push(notificationEnabled ? 1 : 0);
    }
    if (phone !== undefined) {
      sets.push('phone = ?');
      values.push(phone);
    }
    if (sets.length === 0) return this.findById(id);
    values.push(id);
    await pool.query(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, values);
    return this.findById(id);
  },

  async getSettings(id) {
    const user = await this.findById(id);
    if (!user) return null;
    return {
      notificationEnabled: !!user.notification_enabled,
      phone: user.phone || '',
    };
  },
};

module.exports = userService;
