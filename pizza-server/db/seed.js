const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const config = require('../src/config');

async function seed() {
  const conn = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    charset: config.db.charset,
    multipleStatements: true,
  });

  const seedPath = path.join(__dirname, 'seed.sql');
  const seedSQL = fs.readFileSync(seedPath, 'utf8');

  console.log('[Seed] Running seed.sql...');
  await conn.query(seedSQL);
  console.log('[Seed] Seed data inserted successfully.');
  await conn.end();
}

seed().catch(err => {
  console.error('[Seed] Failed:', err.message);
  process.exit(1);
});
