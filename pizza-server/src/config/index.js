const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'pizza',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4',
  },

  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  sessionSecret: process.env.SESSION_SECRET || 'session-secret-change-me',

  wx: {
    appId: process.env.WX_APPID || '',
    secret: process.env.WX_SECRET || '',
  },

  wxPay: {
    mchId: process.env.WX_MCH_ID || '',
    apiV3Key: process.env.WX_PAY_API_V3_KEY || '',
    certSerialNo: process.env.WX_PAY_CERT_SERIAL_NO || '',
    privateKeyPath: process.env.WX_PAY_PRIVATE_KEY_PATH || './certs/apiclient_key.pem',
    platformCertPath: process.env.WX_PAY_PLATFORM_CERT_PATH || './certs/platform_cert.pem',
    notifyUrl: process.env.WX_PAY_NOTIFY_URL || '',
    refundNotifyUrl: process.env.WX_PAY_REFUND_NOTIFY_URL || '',
    // Set by systemConfigService.syncPayConfigToMemory() — DB values override .env
    _privateKeyContent: '',
    _platformCertContent: '',
  },

  upload: {
    dir: path.join(__dirname, '..', '..', process.env.UPLOAD_DIR || 'uploads'),
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 5 * 1024 * 1024,
  },

  map: {
    tencentKey: process.env.MAP_TENCENT_KEY || '',
  },

  printer: {
    enabled: process.env.PRINTER_ENABLED === 'true',
    appId: process.env.PRINTER_APPID || '',
    appSecret: process.env.PRINTER_APPSECRET || '',
    sn: process.env.PRINTER_SN || '',
    pkey: process.env.PRINTER_PKEY || '',
    apiBase: process.env.PRINTER_API_BASE || 'https://open.spyun.net',
    copies: parseInt(process.env.PRINTER_COPIES, 10) || 1,
    // 小票模板（可在管理后台设置，DB 值覆盖 .env）
    storeName: process.env.PRINTER_STORE_NAME || '王姐手工披萨',
    footerText: process.env.PRINTER_FOOTER_TEXT || '感谢您的光临！',
    footerTip: process.env.PRINTER_FOOTER_TIP || '请到取餐口出示取餐码',
    audioEnabled: process.env.PRINTER_AUDIO_ENABLED !== 'false',
  },
};

// ── Production env validation ─────────────────────────
if (config.nodeEnv === 'production') {
  const required = [
    ['JWT_SECRET', config.jwtSecret, 'dev-secret-change-me'],
    ['SESSION_SECRET', config.sessionSecret, 'session-secret-change-me'],
    ['DB_PASSWORD', config.db.password, ''],
    ['WX_APPID', config.wx.appId, ''],
    ['WX_SECRET', config.wx.secret, ''],
  ];
  const missing = [];
  for (const [name, value, insecureDefault] of required) {
    if (!value || value === insecureDefault) {
      missing.push(name);
    }
  }
  if (missing.length > 0) {
    console.error(`[Config] FATAL: Missing required env vars in production: ${missing.join(', ')}`);
    console.error('[Config] Set these in .env or environment before starting the server.');
    process.exit(1);
  }
}

module.exports = config;
