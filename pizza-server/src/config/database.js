const mysql = require('mysql2/promise');
const config = require('./index');

const pool = mysql.createPool(config.db);

// Test connection on startup
pool.getConnection()
  .then(conn => {
    console.log('[DB] Connected to MySQL');
    conn.release();
  })
  .catch(err => {
    console.error('[DB] Connection failed:', err.message);
    console.error('[DB] Server will start but database operations will fail');
  });

module.exports = pool;
