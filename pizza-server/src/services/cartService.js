const pool = require('../config/database');

const cartService = {
  async findByUserId(userId) {
    const [rows] = await pool.query(
      `SELECT ci.*, p.name AS product_name, p.price AS product_price, p.image AS product_image,
              p.category_key, p.tag, p.size_desc
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       WHERE ci.user_id = ?`,
      [userId]
    );
    return rows.map(formatCartItem);
  },

  async addItem(userId, productId, quantity, restrictions) {
    const [existing] = await pool.query(
      'SELECT * FROM cart_items WHERE user_id = ? AND product_id = ?',
      [userId, productId]
    );
    if (existing.length > 0) {
      // Merge: add quantity
      const newQty = existing[0].quantity + quantity;
      await pool.query(
        'UPDATE cart_items SET quantity = ?, restrictions = ?, updated_at = NOW() WHERE id = ?',
        [newQty, JSON.stringify(restrictions || []), existing[0].id]
      );
    } else {
      await pool.query(
        'INSERT INTO cart_items (user_id, product_id, quantity, restrictions) VALUES (?, ?, ?, ?)',
        [userId, productId, quantity, JSON.stringify(restrictions || [])]
      );
    }
    return this.findByUserId(userId);
  },

  async updateItem(userId, productId, quantity, restrictions) {
    await pool.query(
      'UPDATE cart_items SET quantity = ?, restrictions = ?, updated_at = NOW() WHERE user_id = ? AND product_id = ?',
      [quantity, JSON.stringify(restrictions || []), userId, productId]
    );
    return this.findByUserId(userId);
  },

  async removeItem(userId, productId) {
    await pool.query(
      'DELETE FROM cart_items WHERE user_id = ? AND product_id = ?',
      [userId, productId]
    );
    return this.findByUserId(userId);
  },

  async clear(userId) {
    await pool.query('DELETE FROM cart_items WHERE user_id = ?', [userId]);
  },

  async getCartWithProducts(userId) {
    // 先清理超过 72 小时未更新的购物车项（防止跨会话僵尸数据累积）
    // 用户每次下单成功后购物车已在事务中清空，此处仅清理"放弃购买"的过期项
    await pool.query(
      'DELETE FROM cart_items WHERE user_id = ? AND updated_at < DATE_SUB(NOW(), INTERVAL 72 HOUR)',
      [userId]
    );
    const [rows] = await pool.query(
      `SELECT ci.id, ci.quantity, ci.restrictions,
              p.id AS product_id, p.name, p.price, p.image, p.category_key, p.tag, p.size_desc
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       WHERE ci.user_id = ? AND p.is_available = 1`,
      [userId]
    );
    return rows.map(r => ({
      id: r.id,
      productId: r.product_id,
      name: r.name,
      price: r.price,
      image: r.image,
      categoryKey: r.category_key,
      tag: r.tag,
      sizeDesc: r.size_desc,
      quantity: r.quantity,
      restrictions: safeJson(r.restrictions, []),
    }));
  },
};

function formatCartItem(row) {
  return {
    id: row.id,
    productId: row.product_id,
    productName: row.product_name,
    productPrice: row.product_price,
    productImage: row.product_image,
    categoryKey: row.category_key,
    tag: row.tag,
    sizeDesc: row.size_desc,
    quantity: row.quantity,
    restrictions: safeJson(row.restrictions, []),
  };
}

function safeJson(val, defaultVal) {
  if (!val) return defaultVal;
  try { return typeof val === 'string' ? JSON.parse(val) : val; }
  catch (_) { return defaultVal; }
}

module.exports = cartService;
