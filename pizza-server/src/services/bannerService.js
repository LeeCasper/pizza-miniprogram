const pool = require('../config/database');

const bannerService = {
  // Public: active banners sorted by sort_order, optionally filtered by scope
  async getActive(scope) {
    let query = 'SELECT * FROM banners WHERE is_active = 1';
    const params = [];
    if (scope) {
      query += ' AND scope IN (?, ?)';
      params.push(scope, 'both');
    }
    query += ' ORDER BY sort_order ASC, id ASC';
    const [rows] = await pool.query(query, params);
    return rows.map(formatBanner);
  },

  // Admin: all banners
  async adminList() {
    const [rows] = await pool.query('SELECT * FROM banners ORDER BY sort_order ASC, id ASC');
    return rows.map(formatBanner);
  },

  async findById(id) {
    const [rows] = await pool.query('SELECT * FROM banners WHERE id = ?', [id]);
    return rows[0] ? formatBanner(rows[0]) : null;
  },

  async create(data) {
    const { image_url, title, subtitle, tag, link_type, link_product_id, link_shop_product_id, link_url, scope, sort_order } = data;
    const [result] = await pool.query(
      `INSERT INTO banners (image_url, title, subtitle, tag, link_type, link_product_id, link_shop_product_id, link_url, scope, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [image_url, title || '', subtitle || '', tag || '',
       link_type || 'none', link_product_id || null, link_shop_product_id || null, link_url || null,
       scope || 'pos', sort_order || 0]
    );
    return this.findById(result.insertId);
  },

  async update(id, data) {
    const fields = ['image_url', 'title', 'subtitle', 'tag', 'link_type', 'link_product_id', 'link_shop_product_id', 'link_url', 'scope', 'sort_order', 'is_active'];
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
    await pool.query(`UPDATE banners SET ${sets.join(', ')} WHERE id = ?`, values);
    return this.findById(id);
  },

  async remove(id) {
    // 真删除:banners 无任何表外键引用(banners 是子方:link_product_id→products)，可安全硬删。
    // 不像 products 需保留行维持 order_items 订单历史外键，故无需 is_deleted 软删标记。
    await pool.query('DELETE FROM banners WHERE id = ?', [id]);
  },

  async toggle(id) {
    await pool.query('UPDATE banners SET is_active = IF(is_active, 0, 1) WHERE id = ?', [id]);
    return this.findById(id);
  },
};

function formatBanner(row) {
  if (!row) return null;
  return {
    id: row.id,
    imageUrl: row.image_url,
    title: row.title,
    subtitle: row.subtitle,
    tag: row.tag,
    linkType: row.link_type,
    linkProductId: row.link_product_id,
    linkShopProductId: row.link_shop_product_id,
    linkUrl: row.link_url,
    scope: row.scope,
    sortOrder: row.sort_order,
    isActive: !!row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

module.exports = bannerService;
