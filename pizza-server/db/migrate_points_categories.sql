-- Points mall categories
CREATE TABLE IF NOT EXISTS points_categories (
  `key` VARCHAR(30) NOT NULL,
  name VARCHAR(50) NOT NULL,
  icon VARCHAR(500) DEFAULT NULL,
  sort_order INT DEFAULT 0,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add category key to points products
ALTER TABLE points_products ADD COLUMN points_category_key VARCHAR(30) DEFAULT NULL AFTER id;
