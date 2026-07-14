/**
 * Content Service — 关于我们 / 用户协议 / 隐私政策
 *
 * 存储于 system_config 表，config_key 前缀 content_。
 * 管理员可编辑，小程序通过公开接口获取。
 */
const pool = require('../config/database');

const CONTENT_KEYS = ['content_about', 'content_agreement', 'content_privacy'];

const KEY_LABELS = {
  content_about: '关于我们',
  content_agreement: '用户协议',
  content_privacy: '隐私政策',
};

const contentService = {
  KEY_LABELS,

  /** 获取所有内容项（管理员用） */
  async getAll() {
    const [rows] = await pool.query(
      'SELECT config_key, config_value, updated_at FROM system_config WHERE config_key IN (?, ?, ?)',
      CONTENT_KEYS
    );
    const map = {};
    for (const k of CONTENT_KEYS) {
      map[k] = { config_key: k, config_value: '', updated_at: null, label: KEY_LABELS[k] };
    }
    for (const r of rows) {
      map[r.config_key] = {
        config_key: r.config_key,
        config_value: r.config_value || '',
        updated_at: r.updated_at,
        label: KEY_LABELS[r.config_key] || r.config_key,
      };
    }
    return Object.values(map);
  },

  /** 获取单项内容（公开，供小程序使用） */
  async get(key) {
    if (!CONTENT_KEYS.includes(key)) return null;
    const [[row]] = await pool.query(
      'SELECT config_key, config_value, updated_at FROM system_config WHERE config_key = ?',
      [key]
    );
    return row
      ? { key: row.config_key, value: row.config_value || '', updatedAt: row.updated_at, label: KEY_LABELS[row.config_key] }
      : { key, value: '', updatedAt: null, label: KEY_LABELS[key] || key };
  },

  /** 更新单项内容（UPSERT） */
  async update(key, value) {
    if (!CONTENT_KEYS.includes(key)) return false;
    await pool.query(
      'INSERT INTO system_config (config_key, config_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE config_value = ?',
      [key, value, value]
    );
    return true;
  },
};

module.exports = contentService;
