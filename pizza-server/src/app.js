const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const MySQLStoreFactory = require('express-mysql-session');
const path = require('path');
const cron = require('node-cron');
const ejsLayouts = require('express-ejs-layouts');

const config = require('./config');
const { errorHandler } = require('./middleware/errorHandler');
const { requestId } = require('./middleware/requestId');
const { createLogger } = require('./utils/logger');
const couponService = require('./services/couponService');
const orderCleanupService = require('./services/orderCleanupService');
const orderAutoCompleteService = require('./services/orderAutoCompleteService');
const pool = require('./config/database');

const serverLog = createLogger('Server');
const cronLog = createLogger('Cron');

// Route imports
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const productRoutes = require('./routes/products');
const shopRoutes = require('./routes/shop');
const cartRoutes = require('./routes/cart');
const orderRoutes = require('./routes/orders');
const addressRoutes = require('./routes/addresses');
const couponRoutes = require('./routes/coupons');
const pointsRoutes = require('./routes/points');
const storeRoutes = require('./routes/stores');
const uploadRoutes = require('./routes/upload');
const adminRoutes = require('./routes/admin/index');
const adminApiRoutes = require('./routes/adminApi');

const app = express();

// ── Security middleware ───────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false,   // EJS admin pages use inline styles/scripts
  crossOriginEmbedderPolicy: false,
}));

// CORS whitelist
const allowedOrigins = [
  'https://pizza.artaides.com',
  'https://www.pizza.artaides.com',
];
if (config.nodeEnv !== 'production') {
  allowedOrigins.push('http://localhost:9527', 'http://localhost:5173', 'http://127.0.0.1:9527');
}
app.use(cors({
  origin(origin, cb) {
    // Allow requests with no origin (mobile apps, curl, WeChat mini-program)
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(null, false);
  },
  credentials: true,
}));

// ── Rate limiting ─────────────────────────────────────
app.set('trust proxy', 1);

// Global API rate limit: 600 req / 15 min per IP (10× miniprogram startup burst)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 429, message: '请求过于频繁，请稍后再试' },
  skip: (req) => req.path === '/health',
});
app.use('/api/', apiLimiter);

// Strict rate limit for auth endpoints: 20 req / 15 min
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 429, message: '登录请求过于频繁，请稍后再试' },
});
app.use('/api/v1/auth', authLimiter);

// Strict rate limit for payment endpoints: 30 req / 15 min
const payLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 429, message: '支付请求过于频繁，请稍后再试' },
});
app.use('/api/v1/pay', payLimiter);

// WeChat Pay callbacks MUST receive raw body for signature verification.
// Mount BEFORE express.json() so the raw parser claims the request first.
app.use('/api/v1/pay/notify', express.raw({ type: 'application/json' }));
app.use('/api/v1/pay/refund-notify', express.raw({ type: 'application/json' }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Request ID ────────────────────────────────────────
app.use(requestId);

// Static files (uploads & admin assets)
// Override helmet's Cross-Origin-Resource-Policy for uploads —
// WeChat Mini Program renderer loads images cross-origin; 'same-origin' blocks them.
app.use('/uploads', (req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(config.upload.dir));
app.use('/admin/assets', express.static(path.join(__dirname, '..', 'public')));

// ── View engine (EJS for admin panel) ──────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'layouts/admin');
app.use(ejsLayouts);

// ── Session (admin panel) ──────────────────────────────
const MySQLStore = MySQLStoreFactory(session);
const sessionStore = new MySQLStore({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  charset: 'utf8mb4',
  createDatabaseTable: true,
  schema: {
    tableName: 'sessions',
    columnNames: {
      session_id: 'session_id',
      expires: 'expires',
      data: 'data',
    },
  },
});

app.use(session({
  key: 'pizza_admin_sid',
  secret: config.sessionSecret,
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true,
    secure: config.nodeEnv === 'production',
  },
}));

// ── API routes ─────────────────────────────────────────
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/user', userRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/shop', shopRoutes);
app.use('/api/v1/cart', cartRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/addresses', addressRoutes);
app.use('/api/v1/coupons', couponRoutes);
app.use('/api/v1/points', pointsRoutes);
app.use('/api/v1/stores', storeRoutes);
app.use('/api/v1/upload', uploadRoutes);
app.use('/api/v1/banners', require('./routes/banners'));
app.use('/api/v1/pay', require('./routes/payment'));
app.use('/api/v1/config', require('./routes/config'));

const luckyWheelRoutes = require('./routes/luckyWheel');
app.use('/api/v1/lucky-wheel', luckyWheelRoutes);
app.use('/api/v1/logistics', require('./routes/logistics'));

// ── Admin API routes (JSON, JWT) ─────────────────────
app.use('/api/v1/admin', adminApiRoutes);

// ── Admin routes (EJS) ─────────────────────────────────
app.use('/admin', adminRoutes);

// ── Root ───────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Pizza Server API' });
});

// ── Health check ───────────────────────────────────────
app.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  };
  try {
    await pool.query('SELECT 1');
    health.db = 'ok';
  } catch (err) {
    health.status = 'degraded';
    health.db = 'unreachable';
    serverLog.warn({ err }, 'Health check: DB unreachable');
  }
  const httpStatus = health.status === 'ok' ? 200 : 503;
  res.status(httpStatus).json(health);
});

// ── 404 ────────────────────────────────────────────────
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ code: 404, message: '接口不存在' });
  }
  res.status(404).send('Not Found');
});

// ── Error handler ──────────────────────────────────────
app.use(errorHandler);

// ── Cron: issue birthday coupons daily at 8am ────────────
const birthdayCouponService = require('./services/birthdayCouponService');
const birthdayCouponJob = cron.schedule('0 8 * * *', async () => {
  try {
    const { issued, total } = await birthdayCouponService.issueDaily();
    if (issued > 0) {
      cronLog.info({ issued, total }, 'Issued birthday coupons');
    }
  } catch (err) {
    cronLog.error({ err }, 'Birthday coupon error');
  }
});

// ── Cron: expire overdue coupons daily at 2am ──────────
const couponCronJob = cron.schedule('0 2 * * *', async () => {
  try {
    const count = await couponService.expireOverdue();
    if (count > 0) {
      cronLog.info({ count }, 'Expired overdue coupons');
    }
  } catch (err) {
    cronLog.error({ err }, 'Coupon expiration error');
  }
});

// ── Cron: auto-cancel unpaid orders every 5 minutes ─────
const orderCleanupJob = cron.schedule('*/5 * * * *', async () => {
  try {
    const count = await orderCleanupService.cancelExpiredUnpaidOrders();
    if (count > 0) {
      cronLog.info({ count }, 'Auto-cancelled unpaid orders');
    }
  } catch (err) {
    cronLog.error({ err }, 'Order cleanup error');
  }
});

// ── Cron: auto-complete picked-up orders every 5 minutes ──
const autoCompleteJob = cron.schedule('*/5 * * * *', async () => {
  try {
    const count = await orderAutoCompleteService.autoCompleteOrders();
    if (count > 0) {
      cronLog.info({ count }, 'Auto-completed pickup orders');
    }
  } catch (err) {
    cronLog.error({ err }, 'Auto-complete error');
  }
});

// ── Graceful shutdown ──────────────────────────────────
let isShuttingDown = false;

async function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  serverLog.info({ signal }, 'Shutdown initiated');

  // 1. Stop accepting new connections
  server.close(() => {
    serverLog.info('HTTP server closed');
  });

  // 2. Stop cron jobs
  birthdayCouponJob.stop();
  couponCronJob.stop();
  orderCleanupJob.stop();
  autoCompleteJob.stop();

  // 3. Close DB pool
  try {
    await pool.end();
    serverLog.info('DB pool closed');
  } catch (err) {
    serverLog.error({ err }, 'DB pool close error');
  }

  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  serverLog.error({ err: reason }, 'Unhandled rejection');
  // Do NOT exit — for a pizza shop, staying up beats crashing
});

process.on('uncaughtException', (err) => {
  serverLog.fatal({ err }, 'Uncaught exception — crashing');
  process.exit(1);
});

// ── Start ──────────────────────────────────────────────
const PORT = config.port;
const server = app.listen(PORT, async () => {
  serverLog.info({ port: PORT, env: config.nodeEnv }, 'Pizza API started');

  // Sync WeChat Pay config from DB (overrides .env defaults)
  try {
    const systemConfigService = require('./services/systemConfigService');
    await systemConfigService.syncPayConfigToMemory();
    systemConfigService.syncPrinterConfigToMemory();
    systemConfigService.syncMapConfigToMemory();
    systemConfigService.syncBusinessConfigToMemory();
    systemConfigService.syncLogisticsConfigToMemory();
    systemConfigService.syncStorageConfigToMemory();
  } catch (err) {
    serverLog.warn({ err }, 'Could not sync config from DB');
  }
});

module.exports = app;
