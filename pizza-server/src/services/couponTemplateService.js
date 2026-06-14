const pool = require('../config/database');

const couponTemplateService = {
  async adminList() {
    const [rows] = await pool.query('SELECT * FROM coupon_templates ORDER BY id DESC');
    return rows.map(formatTemplate);
  },

  async findById(id) {
    const [rows] = await pool.query('SELECT * FROM coupon_templates WHERE id = ?', [id]);
    return rows[0] ? formatTemplate(rows[0]) : null;
  },

  async create(data) {
    const { name, desc, category, value, discount_type, discount_value, min_spend, valid_days, color, use_tip } = data;
    const [result] = await pool.query(
      `INSERT INTO coupon_templates (name, \`desc\`, category, \`value\`, discount_type, discount_value, min_spend, valid_days, color, use_tip)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, desc || '', category || 'discount', value || '',
       discount_type || 'fixed_amount', discount_value || '',
       min_spend || 0, valid_days || 30, color || '#D32F2F', use_tip || '']
    );
    return this.findById(result.insertId);
  },

  async update(id, data) {
    const fields = ['name', 'desc', 'category', 'value', 'discount_type', 'discount_value',
      'min_spend', 'valid_days', 'color', 'use_tip', 'is_active'];
    const sets = [];
    const values = [];
    for (const f of fields) {
      if (data[f] !== undefined) {
        sets.push(`\`${f}\` = ?`);
        values.push(data[f]);
      }
    }
    if (sets.length === 0) return this.findById(id);
    values.push(id);
    await pool.query(`UPDATE coupon_templates SET ${sets.join(', ')} WHERE id = ?`, values);
    return this.findById(id);
  },

  async softDelete(id) {
    await pool.query('UPDATE coupon_templates SET is_active = 0 WHERE id = ?', [id]);
  },

  async toggle(id) {
    await pool.query('UPDATE coupon_templates SET is_active = IF(is_active, 0, 1) WHERE id = ?', [id]);
    return this.findById(id);
  },
};

function formatTemplate(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    desc: row.desc,
    category: row.category,
    value: row.value,
    discountType: row.discount_type,
    discountValue: row.discount_value,
    minSpend: parseFloat(row.min_spend || 0),
    validDays: row.valid_days,
    color: row.color,
    useTip: row.use_tip,
    isActive: !!row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

module.exports = couponTemplateService;
