// src/services/shopFavoriteService.js — 会员商城收藏
const pool = require('../config/database');

const shopFavoriteService = {
  async list(userId) {
    const [rows] = await pool.query(
      `SELECT p.* FROM shop_favorites f
       JOIN shop_products p ON p.id = f.shop_product_id
       WHERE f.user_id = ? AND p.is_deleted = 0
       ORDER BY f.created_at DESC`,
      [userId]
    );
    return rows.map(formatFavorite);
  },

  async add(userId, productId) {
    await pool.query(
      'INSERT INTO shop_favorites (user_id, shop_product_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE id = id',
      [userId, productId]
    );
  },

  async remove(userId, productId) {
    await pool.query(
      'DELETE FROM shop_favorites WHERE user_id = ? AND shop_product_id = ?',
      [userId, productId]
    );
  },

  async exists(productId) {
    const [rows] = await pool.query(
      'SELECT id FROM shop_products WHERE id = ? AND is_deleted = 0',
      [productId]
    );
    return rows.length > 0;
  },
};

function formatFavorite(row) {
  return {
    ...row,
    images: safeJson(row.images, []),
    isFavorited: true,
  };
}

function safeJson(val, d) {
  if (!val) return d;
  try { return typeof val === 'string' ? JSON.parse(val) : val; } catch (_) { return d; }
}

module.exports = shopFavoriteService;
