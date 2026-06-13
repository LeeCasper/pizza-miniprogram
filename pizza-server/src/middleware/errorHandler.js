function errorHandler(err, req, res, _next) {
  console.error('[ERROR]', err.message || err);

  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ code: 409, message: '数据已存在' });
  }

  const status = err.status || 500;
  const message = err.expose ? err.message : '服务器繁忙，请稍后再试';
  res.status(status).json({ code: status, message });
}

module.exports = { errorHandler };
