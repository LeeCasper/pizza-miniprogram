/**
 * System Config Service
 *
 * Reads/writes system-level configuration from the system_config table.
 * Values from DB override .env defaults, enabling admin-panel configuration.
 */

const pool = require('../config/database');
const fs = require('fs');
const path = require('path');
const config = require('../config');

// Cert file paths
const CERTS_DIR = path.join(__dirname, '..', '..', 'certs');
const PRIVATE_KEY_PATH = path.join(CERTS_DIR, 'apiclient_key.pem');
const PLATFORM_CERT_PATH = path.join(CERTS_DIR, 'platform_cert.pem');

const systemConfigService = {

  /**
   * Get all payment-related config from DB.
   * Returns an object with camelCase keys mapping to DB values.
   *
   * @returns {Promise<{ mchId, apiV3Key, certSerialNo, privateKey, platformCert, notifyUrl }>}
   */
  async getPayConfig() {
    try {
      const [rows] = await pool.query(
        "SELECT config_key, config_value FROM system_config WHERE config_key LIKE 'wx_pay_%'"
      );
      const map = {};
      rows.forEach(r => { map[r.config_key] = r.config_value || ''; });
      return {
        mchId: map.wx_pay_mch_id || '',
        apiV3Key: map.wx_pay_api_v3_key || '',
        certSerialNo: map.wx_pay_cert_serial_no || '',
        privateKey: map.wx_pay_private_key || '',
        platformCert: map.wx_pay_platform_cert || '',
        notifyUrl: map.wx_pay_notify_url || '',
      };
    } catch (_) {
      // Table might not exist yet — return empty
      return { mchId: '', apiV3Key: '', certSerialNo: '', privateKey: '', platformCert: '', notifyUrl: '' };
    }
  },

  /**
   * Update payment config in DB (UPSERT per key).
   * Also syncs cert PEM content to disk files.
   *
   * @param {object} entries - { mchId, apiV3Key, certSerialNo, privateKey, platformCert, notifyUrl }
   */
  async updatePayConfig(entries) {
    const fieldMap = {
      mchId: 'wx_pay_mch_id',
      apiV3Key: 'wx_pay_api_v3_key',
      certSerialNo: 'wx_pay_cert_serial_no',
      privateKey: 'wx_pay_private_key',
      platformCert: 'wx_pay_platform_cert',
      notifyUrl: 'wx_pay_notify_url',
    };

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      for (const [camelKey, dbKey] of Object.entries(fieldMap)) {
        if (entries[camelKey] !== undefined) {
          // Allow empty strings (clear config) but not nullish
          const value = entries[camelKey] != null ? String(entries[camelKey]) : null;
          if (value !== null) {
            await conn.query(
              'INSERT INTO system_config (config_key, config_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE config_value = ?',
              [dbKey, value, value]
            );
          }
        }
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    // Sync cert content to disk files
    this._writeCertFiles(entries.privateKey, entries.platformCert);
  },

  /**
   * Write PEM content to disk cert files (for compatibility with file-based readers).
   */
  _writeCertFiles(privateKeyContent, platformCertContent) {
    try {
      if (!fs.existsSync(CERTS_DIR)) {
        fs.mkdirSync(CERTS_DIR, { recursive: true });
      }
      if (privateKeyContent !== undefined && privateKeyContent.trim()) {
        fs.writeFileSync(PRIVATE_KEY_PATH, privateKeyContent.trim(), 'utf8');
        console.log('[Config] Private key synced to disk');
      }
      if (platformCertContent !== undefined && platformCertContent.trim()) {
        fs.writeFileSync(PLATFORM_CERT_PATH, platformCertContent.trim(), 'utf8');
        console.log('[Config] Platform cert synced to disk');
      }
    } catch (err) {
      console.error('[Config] Failed to write cert files:', err.message);
    }
  },

  /**
   * Sync DB config into the in-memory config object and disk cert files.
   * Called on server startup and after admin saves new config.
   */
  async syncPayConfigToMemory() {
    try {
      const dbConfig = await this.getPayConfig();

      // Only override in-memory config with non-empty DB values
      if (dbConfig.mchId) config.wxPay.mchId = dbConfig.mchId;
      if (dbConfig.apiV3Key) config.wxPay.apiV3Key = dbConfig.apiV3Key;
      if (dbConfig.certSerialNo) config.wxPay.certSerialNo = dbConfig.certSerialNo;
      if (dbConfig.notifyUrl) config.wxPay.notifyUrl = dbConfig.notifyUrl;

      // Store PEM content directly on config for wechatPay.js to use
      if (dbConfig.privateKey) config.wxPay._privateKeyContent = dbConfig.privateKey;
      if (dbConfig.platformCert) config.wxPay._platformCertContent = dbConfig.platformCert;

      // Also write to disk files
      this._writeCertFiles(dbConfig.privateKey, dbConfig.platformCert);

      console.log('[Config] Pay config synced from DB');
    } catch (err) {
      console.error('[Config] Failed to sync pay config from DB:', err.message);
    }
  },
};

  // ── Printer Config ──────────────────────────────────

  /**
   * Get printer config from DB.
   * @returns {Promise<{ enabled, appId, appSecret, sn, apiBase, copies }>}
   */
  async getPrinterConfig() {
    try {
      const [rows] = await pool.query(
        "SELECT config_key, config_value FROM system_config WHERE config_key LIKE 'printer_%'"
      );
      const map = {};
      rows.forEach(r => { map[r.config_key] = r.config_value || ''; });
      return {
        enabled: map.printer_enabled || '',
        appId: map.printer_app_id || '',
        appSecret: map.printer_app_secret || '',
        sn: map.printer_sn || '',
        apiBase: map.printer_api_base || '',
        copies: map.printer_copies || '1',
      };
    } catch (_) {
      return { enabled: '', appId: '', appSecret: '', sn: '', apiBase: '', copies: '1' };
    }
  },

  /**
   * Update printer config in DB (UPSERT per key).
   * @param {object} entries — { enabled, appId, appSecret, sn, apiBase, copies }
   */
  async updatePrinterConfig(entries) {
    const fieldMap = {
      enabled: 'printer_enabled',
      appId: 'printer_app_id',
      appSecret: 'printer_app_secret',
      sn: 'printer_sn',
      apiBase: 'printer_api_base',
      copies: 'printer_copies',
    };

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      for (const [camelKey, dbKey] of Object.entries(fieldMap)) {
        if (entries[camelKey] !== undefined) {
          const value = entries[camelKey] != null ? String(entries[camelKey]) : '';
          await conn.query(
            'INSERT INTO system_config (config_key, config_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE config_value = ?',
            [dbKey, value, value]
          );
        }
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    // Sync to in-memory config
    this.syncPrinterConfigToMemory();
  },

  /**
   * Sync printer DB config to in-memory config object.
   */
  syncPrinterConfigToMemory() {
    this.getPrinterConfig().then(dbConfig => {
      if (dbConfig.enabled !== '') config.printer.enabled = dbConfig.enabled === 'true';
      if (dbConfig.appId) config.printer.appId = dbConfig.appId;
      if (dbConfig.appSecret) config.printer.appSecret = dbConfig.appSecret;
      if (dbConfig.sn) config.printer.sn = dbConfig.sn;
      if (dbConfig.apiBase) config.printer.apiBase = dbConfig.apiBase;
      if (dbConfig.copies) config.printer.copies = parseInt(dbConfig.copies, 10) || 1;
    }).catch(err => {
      console.error('[Config] Failed to sync printer config from DB:', err.message);
    });
  },
};

module.exports = systemConfigService;
