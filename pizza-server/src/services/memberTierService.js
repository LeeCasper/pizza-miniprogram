const pool = require('../config/database');

const memberTierService = {
  async getAll() {
    const [rows] = await pool.query('SELECT * FROM member_tiers ORDER BY level_index ASC');
    return rows.map(formatTier);
  },

  async getActive() {
    const [rows] = await pool.query(
      'SELECT * FROM member_tiers WHERE is_active = 1 ORDER BY level_index ASC'
    );
    return rows.map(formatTier);
  },

  async getById(id) {
    const [rows] = await pool.query('SELECT * FROM member_tiers WHERE id = ?', [id]);
    return rows[0] ? formatTier(rows[0]) : null;
  },

  async getByKey(levelKey) {
    const [rows] = await pool.query('SELECT * FROM member_tiers WHERE level_key = ?', [levelKey]);
    return rows[0] ? formatTier(rows[0]) : null;
  },

  async create(data) {
    const {
      level_key, name, level_index, min_spent, discount_rate,
      points_reward_rate, birthday_gift, coupon_value,
      accent_color, bg_start_color, bg_end_color
    } = data;
    const [result] = await pool.query(
      `INSERT INTO member_tiers (level_key, name, level_index, min_spent, discount_rate,
       points_reward_rate, birthday_gift, coupon_value,
       accent_color, bg_start_color, bg_end_color)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        level_key, name, level_index,
        min_spent || 0, discount_rate || 1.00,
        points_reward_rate || 1.00, birthday_gift || '', coupon_value || 0,
        accent_color || '#c0c0c0', bg_start_color || 'rgba(60,60,65,0.88)', bg_end_color || 'rgba(25,25,30,0.95)'
      ]
    );
    return this.getById(result.insertId);
  },

  async update(id, data) {
    const fields = [
      'level_key', 'name', 'level_index', 'min_spent', 'discount_rate',
      'points_reward_rate', 'birthday_gift', 'coupon_value',
      'accent_color', 'bg_start_color', 'bg_end_color', 'is_active'
    ];
    const sets = [];
    const values = [];
    for (const f of fields) {
      if (data[f] !== undefined) {
        sets.push(`\`${f}\` = ?`);
        values.push(data[f]);
      }
    }
    if (sets.length === 0) return this.getById(id);
    values.push(id);
    await pool.query(`UPDATE member_tiers SET ${sets.join(', ')} WHERE id = ?`, values);
    return this.getById(id);
  },

  async softDelete(id) {
    await pool.query('UPDATE member_tiers SET is_active = 0 WHERE id = ?', [id]);
  },

  async toggle(id) {
    await pool.query('UPDATE member_tiers SET is_active = IF(is_active, 0, 1) WHERE id = ?', [id]);
    return this.getById(id);
  },
};

function formatTier(row) {
  if (!row) return null;
  return {
    id: row.id,
    levelKey: row.level_key,
    name: row.name,
    levelIndex: row.level_index,
    minSpent: parseFloat(row.min_spent || 0),
    discountRate: parseFloat(row.discount_rate || 1),
    pointsRewardRate: parseFloat(row.points_reward_rate || 1),
    birthdayGift: row.birthday_gift,
    couponValue: parseFloat(row.coupon_value || 0),
    accentColor: row.accent_color,
    bgStartColor: row.bg_start_color,
    bgEndColor: row.bg_end_color,
    isActive: !!row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

module.exports = memberTierService;
