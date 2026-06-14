const express = require('express');
const cors = require('cors');
const session = require('express-session');
const MySQLStoreFactory = require('express-mysql-session');
const path = require('path');
const cron = require('node-cron');
const ejsLayouts = require('express-ejs-layouts');

const config = require('./config');
const { errorHandler } = require('./middleware/errorHandler');
const couponService = require('./services/couponService');

// Route imports
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const productRoutes = require('./routes/products');
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

// ── Global middleware ──────────────────────────────────
app.use(cors());
app.set('trust proxy', 1);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files (uploads & admin assets)
app.use('/uploads', express.static(config.upload.dir));
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
app.use('/api/v1/cart', cartRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/addresses', addressRoutes);
app.use('/api/v1/coupons', couponRoutes);
app.use('/api/v1/points', pointsRoutes);
app.use('/api/v1/stores', storeRoutes);
app.use('/api/v1/upload', uploadRoutes);

// ── Admin API routes (JSON, JWT) ─────────────────────
app.use('/api/v1/admin', adminApiRoutes);

// ── Admin routes (EJS) ─────────────────────────────────
app.use('/admin', adminRoutes);

// ── Health check ───────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
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

// ── Cron: expire overdue coupons daily at 2am ──────────
cron.schedule('0 2 * * *', async () => {
  try {
    const count = await couponService.expireOverdue();
    if (count > 0) {
      console.log(`[Cron] Expired ${count} overdue coupons`);
    }
  } catch (err) {
    console.error('[Cron] Coupon expiration error:', err.message);
  }
});

// ── Start ──────────────────────────────────────────────
const PORT = config.port;
app.listen(PORT, () => {
  console.log(`[Server] Pizza API running on http://localhost:${PORT}`);
  console.log(`[Server] Admin panel: http://localhost:${PORT}/admin`);
  console.log(`[Server] Environment: ${config.nodeEnv}`);
});

module.exports = app;
