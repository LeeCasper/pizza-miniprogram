const pool = require('../config/database');

const userService = {
  async findByOpenid(openid) {
    const [rows] = await pool.query('SELECT * FROM users WHERE openid = ?', [openid]);
    return rows[0] || null;
  },

  async findById(id) {
    const [rows] = await pool.query(
      'SELECT id, openid, name, avatar, bio, phone, points, balance, total_spent, member_level, notification_enabled, role, created_at, updated_at FROM users WHERE id = ?',
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

  async adminList({ search, page = 1, limit = 20 } = {}) {
    let sql = `SELECT u.*, COUNT(o.id) AS order_count
               FROM users u LEFT JOIN orders o ON u.id = o.user_id`;
    const params = [];
    if (search) {
      sql += ' WHERE u.name LIKE ? OR u.phone LIKE ?';
      params.push(`%${search}%`, `%${search}%`);
    }
    sql += ' GROUP BY u.id ORDER BY u.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, (page - 1) * limit);

    const [rows] = await pool.query(sql, params);
    return rows.map(r => ({
      id: r.id,
      openid: r.openid,
      name: r.name,
      avatar: r.avatar,
      bio: r.bio,
      phone: r.phone,
      points: r.points,
      balance: parseFloat(r.balance || 0),
      totalSpent: parseFloat(r.total_spent || 0),
      memberLevel: r.member_level,
      notificationEnabled: !!r.notification_enabled,
      role: r.role,
      orderCount: r.order_count,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  },

  async getSettings(id) {
    const user = await this.findById(id);
    if (!user) return null;
    return {
      notificationEnabled: !!user.notification_enabled,
      phone: user.phone || '',
    };
  },

  async rechargeBalance(id, amount, remark) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [[user]] = await conn.query('SELECT balance FROM users WHERE id = ?', [id]);
      if (!user) throw new Error('用户不存在');
      const balanceAfter = parseFloat(user.balance) + parseFloat(amount);
      await conn.query('UPDATE users SET balance = ? WHERE id = ?', [balanceAfter, id]);
      await conn.query(
        'INSERT INTO balance_history (user_id, amount, balance_after, type, remark) VALUES (?, ?, ?, ?, ?)',
        [id, amount, balanceAfter, 'recharge', remark || '余额充值']
      );
      await conn.commit();
      return { balance: balanceAfter };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  async getBalanceHistory(id, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const [[{ total }]] = await pool.query(
      'SELECT COUNT(*) AS total FROM balance_history WHERE user_id = ?', [id]
    );
    const [rows] = await pool.query(
      'SELECT id, amount, balance_after, type, remark, created_at FROM balance_history WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [id, limit, offset]
    );
    return { total, list: rows };
  },

  async adminUpdate(id, data) {
    const sets = [];
    const values = [];
    if (data.name !== undefined) { sets.push('name = ?'); values.push(data.name); }
    if (data.phone !== undefined) { sets.push('phone = ?'); values.push(data.phone); }
    if (data.points !== undefined) { sets.push('points = ?'); values.push(parseInt(data.points)); }
    if (data.balance !== undefined) { sets.push('balance = ?'); values.push(parseFloat(data.balance)); }
    if (data.totalSpent !== undefined) { sets.push('total_spent = ?'); values.push(parseFloat(data.totalSpent)); }
    if (data.memberLevel !== undefined) { sets.push('member_level = ?'); values.push(data.memberLevel); }
    if (sets.length === 0) return this.findById(id);
    values.push(id);
    await pool.query(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, values);
    return this.findById(id);
  },
};

module.exports = userService;
