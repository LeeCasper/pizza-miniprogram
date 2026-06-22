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
    const { name, desc, category, value, discount_type, discount_value, min_spend, valid_days, color, use_tip,
            claimable, total_stock, per_user_limit, claim_period, min_member_level, max_discount } = data;
    const [result] = await pool.query(
      `INSERT INTO coupon_templates
         (name, \`desc\`, category, \`value\`, discount_type, discount_value, min_spend, valid_days, color, use_tip,
          claimable, total_stock, per_user_limit, claim_period, min_member_level, max_discount)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, desc || '', category || 'discount', value || '',
       discount_type || 'fixed_amount', discount_value || '',
       min_spend || 0, valid_days || 30, color || '#D32F2F', use_tip || '',
       claimable ? 1 : 0, total_stock == null ? null : total_stock,
       per_user_limit == null ? 1 : per_user_limit, claim_period || 'none',
       min_member_level == null ? 0 : min_member_level, max_discount == null ? null : max_discount]
    );
    return this.findById(result.insertId);
  },

  async update(id, data) {
    const fields = ['name', 'desc', 'category', 'value', 'discount_type', 'discount_value',
      'min_spend', 'valid_days', 'color', 'use_tip', 'is_active',
      'claimable', 'total_stock', 'per_user_limit', 'claim_period', 'min_member_level', 'max_discount'];
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
    claimable: !!row.claimable,
    totalStock: row.total_stock == null ? null : row.total_stock,
    claimedCount: row.claimed_count || 0,
    perUserLimit: row.per_user_limit == null ? 1 : row.per_user_limit,
    claimPeriod: row.claim_period || 'none',
    minMemberLevel: row.min_member_level || 0,
    maxDiscount: row.max_discount == null ? null : parseFloat(row.max_discount),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

module.exports = couponTemplateService;
