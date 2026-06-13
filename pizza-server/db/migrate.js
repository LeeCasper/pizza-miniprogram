const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const config = require('../src/config');

async function migrate() {
  // First connect without database to create it
  const initConn = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    charset: config.db.charset,
  });

  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');

  console.log('[Migrate] Running schema.sql...');
  await initConn.query(schema);
  console.log('[Migrate] Schema created successfully.');
  await initConn.end();
}

migrate().catch(err => {
  console.error('[Migrate] Failed:', err);
  process.exit(1);
});
