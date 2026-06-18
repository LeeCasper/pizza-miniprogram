const crypto = require('crypto');

/**
 * Assigns a unique request ID to each request.
 * Respects upstream X-Request-Id header (e.g. from Nginx).
 */
function requestId(req, res, next) {
  const id = req.headers['x-request-id'] || crypto.randomBytes(8).toString('hex');
  req.id = id;
  res.setHeader('X-Request-Id', id);
  next();
}

module.exports = { requestId };
