function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ code: 403, message: '无权限' });
  }
  next();
}

module.exports = { adminOnly };
