-- ============================================================
-- Phase 3 Business Improvements Migration — v1.9.7.0
-- Run: mysql -u root -p pizza < db/migrate_phase3_business.sql
-- ============================================================

-- 1. users.total_recharge — track recharge spending separately
ALTER TABLE users
  ADD COLUMN total_recharge DECIMAL(10,2) NOT NULL DEFAULT 0.00
  AFTER total_spent;

-- 2. Backfill total_recharge from balance_history
UPDATE users u
SET u.total_recharge = COALESCE((
  SELECT SUM(bh.amount)
  FROM balance_history bh
  WHERE bh.user_id = u.id
    AND bh.type = 'recharge'
    AND bh.amount > 0
), 0);

-- 3. Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  actor_type   ENUM('user','admin','system') NOT NULL DEFAULT 'system',
  actor_id     INT UNSIGNED NULL,
  actor_name   VARCHAR(100) NULL,
  action       VARCHAR(100) NOT NULL,
  entity_type  VARCHAR(50) NOT NULL,
  entity_id    VARCHAR(50) NOT NULL,
  before_value JSON NULL,
  after_value  JSON NULL,
  metadata     JSON NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_entity (entity_type, entity_id),
  INDEX idx_actor (actor_type, actor_id),
  INDEX idx_action (action),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. products.stock — basic inventory (-1 = unlimited, 0 = out of stock, >0 = finite)
ALTER TABLE products
  ADD COLUMN stock INT NOT NULL DEFAULT -1 AFTER is_available;
