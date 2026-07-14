const pool = require('../config/database');
const { createLogger } = require('../utils/logger');
const { getTierLevel } = require('../utils/memberTier');
const auditService = require('./auditService');
const log = createLogger('User');

const userService = {
  async findByOpenid(openid) {
    const [rows] = await pool.query('SELECT * FROM users WHERE openid = ?', [openid]);
    return rows[0] || null;
  },

  async findById(id) {
    const [rows] = await pool.query(
      'SELECT id, openid, name, avatar, bio, birthday, phone, points, balance, total_spent, total_recharge, member_level, notification_enabled, role, created_at, updated_at FROM users WHERE id = ?',
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

  async updateProfile(id, { name, bio, birthday }) {
    const sets = [];
    const values = [];
    let isFirstBirthdaySet = false;
    if (name !== undefined) { sets.push('name = ?'); values.push(name); }
    if (bio !== undefined) { sets.push('bio = ?'); values.push(bio); }
    if (birthday !== undefined) {
      // 生日仅可设置一次，已有生日则拒绝
      const [existing] = await pool.query('SELECT birthday FROM users WHERE id = ?', [id]);
      if (existing.length && existing[0].birthday && birthday) {
        return { code: 'BIRTHDAY_LOCKED', message: '生日已设置，如需修改请联系管理员' };
      }
      isFirstBirthdaySet = !!(birthday && !(existing.length && existing[0].birthday));
      sets.push('birthday = ?'); values.push(birthday || null);
    }
    if (sets.length === 0) return this.findById(id);
    values.push(id);
    await pool.query(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, values);

    // 首次设置生日 + 今天就是生日 → 立即发券（不等明天 cron）
    if (isFirstBirthdaySet && birthday) {
      try {
        const birthdayCouponService = require('./birthdayCouponService');
        await birthdayCouponService.issueForUser(id);
      } catch (err) {
        // 不阻塞 profile 更新
        const { createLogger } = require('../utils/logger');
        createLogger('UserService').warn({ err, userId: id }, 'First-birthday coupon issuance failed');
      }
    }

    return this.findById(id);
  },

  /**
   * 查询当天生日的用户（今年尚未领取生日券的）。
   * birthday 列是 DATE 类型，用 MONTH/DAY 匹配忽略年份。
   */
  async findTodayBirthdayUsers() {
    const today = new Date();
    const month = today.getMonth() + 1;
    const day = today.getDate();
    const year = today.getFullYear();
    const [rows] = await pool.query(
      `SELECT id, name, member_level, birthday FROM users
       WHERE birthday IS NOT NULL
         AND MONTH(birthday) = ? AND DAY(birthday) = ?
         AND (birthday_claimed_year IS NULL OR birthday_claimed_year < ?)`,
      [month, day, year]
    );
    return rows;
  },

  /** 标记用户本年度生日券已领取 */
  async markBirthdayClaimed(userId, year) {
    await pool.query('UPDATE users SET birthday_claimed_year = ? WHERE id = ?', [year, userId]);
  },

  /** 管理员修改用户生日（不受一次性限制）。若改为今天则立即发券。 */
  async adminUpdateBirthday(userId, birthday) {
    await pool.query('UPDATE users SET birthday = ?, birthday_claimed_year = NULL WHERE id = ?', [birthday || null, userId]);

    // 改生日为今天 → 立即发券（清除 claimed_year 后重新判断）
    if (birthday) {
      try {
        const birthdayCouponService = require('./birthdayCouponService');
        await birthdayCouponService.issueForUser(userId);
      } catch (err) {
        const { createLogger } = require('../utils/logger');
        createLogger('UserService').warn({ err, userId }, 'Admin birthday-change coupon issuance failed');
      }
    }

    return this.findById(userId);
  },

  async updateAvatar(id, avatar) {
    await pool.query('UPDATE users SET avatar = ? WHERE id = ?', [avatar, id]);
    return this.findById(id);
  },

  async updateName(id, name) {
    await pool.query('UPDATE users SET name = ? WHERE id = ?', [name, id]);
    return this.findById(id);
  },

  async updatePoints(id, points, memberLevel) {
    await pool.query(
      'UPDATE users SET points = ?, member_level = ? WHERE id = ?',
      [points, memberLevel, id]
    );
  },

  async updatePhone(id, phone) {
    await pool.query('UPDATE users SET phone = ? WHERE id = ?', [phone, id]);
    return this.findById(id);
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
      birthday: r.birthday instanceof Date ? r.birthday.toISOString().slice(0, 10) : (r.birthday ? String(r.birthday).slice(0, 10) : null),
      points: r.points,
      balance: parseFloat(r.balance || 0),
      totalSpent: parseFloat(r.total_spent || 0),
      totalRecharge: parseFloat(r.total_recharge || 0),
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
      const [[user]] = await conn.query(
        'SELECT balance, total_spent, total_recharge, member_level FROM users WHERE id = ? FOR UPDATE',
        [id]
      );
      if (!user) throw new Error('用户不存在');

      const parsedAmount = parseFloat(amount);
      const balanceAfter = parseFloat(user.balance) + parsedAmount;
      const newTotalSpent = parseFloat(user.total_spent) + parsedAmount;
      const newTotalRecharge = parseFloat(user.total_recharge) + parsedAmount;
      const newTierLevel = await getTierLevel(newTotalSpent);

      await conn.query(
        'UPDATE users SET balance = ?, total_spent = ?, total_recharge = ?, member_level = ? WHERE id = ?',
        [balanceAfter, newTotalSpent, newTotalRecharge, newTierLevel, id]
      );
      await conn.query(
        'INSERT INTO balance_history (user_id, amount, balance_after, type, remark) VALUES (?, ?, ?, ?, ?)',
        [id, amount, balanceAfter, 'recharge', remark || '余额充值']
      );

      // Audit: admin recharge
      await auditService.record({
        actorType: 'admin',
        action: 'user.admin_recharge',
        entityType: 'user',
        entityId: id,
        before: { balance: parseFloat(user.balance), totalSpent: parseFloat(user.total_spent), memberLevel: user.member_level },
        after: { balance: balanceAfter, totalSpent: newTotalSpent, memberLevel: newTierLevel },
        metadata: { amount: parsedAmount, remark: remark || '余额充值' },
      }, conn);

      // Audit: tier change (if any)
      if (newTierLevel !== user.member_level) {
        await auditService.record({
          actorType: 'system',
          action: 'user.tier_change',
          entityType: 'user',
          entityId: id,
          before: { memberLevel: user.member_level },
          after: { memberLevel: newTierLevel },
          metadata: { trigger: 'admin_recharge', totalSpent: newTotalSpent },
        }, conn);
      }

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
    if (data.totalRecharge !== undefined) { sets.push('total_recharge = ?'); values.push(parseFloat(data.totalRecharge)); }
    if (data.memberLevel !== undefined) { sets.push('member_level = ?'); values.push(data.memberLevel); }
    if (sets.length === 0) return this.findById(id);
    values.push(id);
    await pool.query(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, values);
    return this.findById(id);
  },

  /**
   * Soft-delete a user account by anonymizing all personal data.
   * Hard delete is impossible because orders/payment_records FK = RESTRICT.
   */
  async deleteAccount(id) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Lock user row
      const [[user]] = await conn.query(
        'SELECT id, balance, points FROM users WHERE id = ? AND deleted_at IS NULL FOR UPDATE',
        [id]
      );
      if (!user) {
        await conn.rollback();
        const err = new Error('账号不存在或已注销');
        err.statusCode = 400;
        throw err;
      }

      // Reject if user has active orders
      const [active] = await conn.query(
        "SELECT id FROM orders WHERE user_id = ? AND status IN ('waiting', 'preparing') LIMIT 1",
        [id]
      );
      if (active.length > 0) {
        await conn.rollback();
        const err = new Error('请先完成或取消进行中的订单');
        err.statusCode = 400;
        err.code = 'HAS_ACTIVE_ORDERS';
        throw err;
      }

      const balance = parseFloat(user.balance || 0);
      const points = parseInt(user.points || 0);

      // Clear balance (if any)
      if (balance > 0) {
        await conn.query('UPDATE users SET balance = 0 WHERE id = ?', [id]);
        await conn.query(
          'INSERT INTO balance_history (user_id, amount, balance_after, type, remark) VALUES (?, ?, 0, ?, ?)',
          [id, -balance, 'deduct', '账号注销清零']
        );
      }

      // Clear points (if any)
      if (points > 0) {
        await conn.query('UPDATE users SET points = 0 WHERE id = ?', [id]);
        await conn.query(
          'INSERT INTO points_history (user_id, points_change, balance_after, reason, reference_id) VALUES (?, ?, 0, ?, ?)',
          [id, -points, '账号注销清零', 'account_deletion']
        );
      }

      // Anonymize personal data
      await conn.query(
        `UPDATE users SET
          openid = CONCAT('deleted_', id),
          unionid = NULL,
          session_key = NULL,
          name = '已注销用户',
          avatar = '',
          bio = '',
          birthday = NULL,
          phone = '',
          notification_enabled = 0,
          deleted_at = NOW(),
          updated_at = NOW()
        WHERE id = ?`,
        [id]
      );

      // Expire all available coupons
      await conn.query(
        "UPDATE coupons SET status = 'expired' WHERE user_id = ? AND status = 'available'",
        [id]
      );

      // Clear cart
      await conn.query('DELETE FROM cart_items WHERE user_id = ?', [id]);

      await conn.commit();
      log.info({ userId: id, balance, points }, 'Account deleted (anonymized)');
      return { success: true };
    } catch (err) {
      await conn.rollback().catch(() => {});
      throw err;
    } finally {
      conn.release();
    }
  },
};

module.exports = userService;
