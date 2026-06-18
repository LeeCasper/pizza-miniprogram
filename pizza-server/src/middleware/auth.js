const { verifyToken } = require('../utils/jwt');
const pool = require('../config/database');

function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ code: 401, message: '未登录' });
  }
  try {
    const payload = verifyToken(header.slice(7));
    req.user = { id: payload.sub, role: payload.role };

    // Check if customer account has been deleted (admin uses separate table)
    if (payload.role !== 'admin') {
      pool.query('SELECT deleted_at FROM users WHERE id = ?', [payload.sub])
        .then(([rows]) => {
          if (!rows[0] || rows[0].deleted_at) {
            return res.status(401).json({ code: 401, message: '账号已注销' });
          }
          next();
        })
        .catch(() => next()); // DB error — let request through, controller will handle
    } else {
      next();
    }
  } catch (err) {
    return res.status(401).json({ code: 401, message: '登录已过期，请重新登录' });
  }
}

/**
 * Optional auth — attaches user if token present, but doesn't reject.
 */
function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    try {
      const payload = verifyToken(header.slice(7));
      req.user = { id: payload.sub, role: payload.role };
    } catch (_) {
      // ignore invalid token
    }
  }
  next();
}

module.exports = { auth, optionalAuth };
