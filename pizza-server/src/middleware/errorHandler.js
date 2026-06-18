const { createLogger } = require('../utils/logger');

const log = createLogger('Error');

function errorHandler(err, req, res, _next) {
  const context = {
    err,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userId: req.user?.id || null,
    reqId: req.id || null,
  };

  if (err.status && err.status < 500) {
    log.warn(context, 'Client error');
  } else {
    log.error(context, 'Server error');
  }

  // Optional Sentry forwarding (only if DSN configured and package installed)
  if (process.env.SENTRY_DSN) {
    try {
      const Sentry = require('@sentry/node');
      Sentry.captureException(err, {
        extra: { method: req.method, url: req.originalUrl, userId: req.user?.id },
      });
    } catch (_) { /* @sentry/node not installed — silently skip */ }
  }

  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ code: 409, message: '数据已存在' });
  }

  const status = err.status || 500;
  const message = err.expose ? err.message : '服务器繁忙，请稍后再试';
  res.status(status).json({ code: status, message });
}

module.exports = { errorHandler };
