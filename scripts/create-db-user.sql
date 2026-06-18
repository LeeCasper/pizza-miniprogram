-- Pizza DB: Create dedicated application user with minimal privileges
-- Run as MySQL root: mysql -u root -p < scripts/create-db-user.sql
-- Then update .env: DB_USER=pizza_app, DB_PASSWORD=<new password>

-- Replace 'CHANGE_ME_STRONG_PASSWORD' with a real password before executing!

CREATE USER IF NOT EXISTS 'pizza_app'@'127.0.0.1'
  IDENTIFIED BY 'CHANGE_ME_STRONG_PASSWORD';

CREATE USER IF NOT EXISTS 'pizza_app'@'localhost'
  IDENTIFIED BY 'CHANGE_ME_STRONG_PASSWORD';

-- DML only: SELECT, INSERT, UPDATE, DELETE
-- No DDL (DROP, ALTER, CREATE) — schema changes go through migration as root
GRANT SELECT, INSERT, UPDATE, DELETE
  ON pizza.*
  TO 'pizza_app'@'127.0.0.1',
     'pizza_app'@'localhost';

-- LOCK TABLES needed for mysqldump --single-transaction
GRANT LOCK TABLES
  ON pizza.*
  TO 'pizza_app'@'127.0.0.1',
     'pizza_app'@'localhost';

FLUSH PRIVILEGES;

-- Verify:
-- SHOW GRANTS FOR 'pizza_app'@'127.0.0.1';
