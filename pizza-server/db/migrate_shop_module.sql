-- 会员商城模块：5 张 shop_* 表（一次性建全；shop_orders/shop_order_items 为 Phase 2 预留）
-- 幂等：CREATE TABLE IF NOT EXISTS

CREATE TABLE IF NOT EXISTS shop_categories (
  `key` VARCHAR(30) NOT NULL COMMENT '分类标识(^[a-z0-9_]+$)',
  name VARCHAR(50) NOT NULL COMMENT '分类名',
  icon VARCHAR(500) DEFAULT NULL COMMENT '分类图标图片URL',
  sort_order INT DEFAULT 0,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shop_products (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  shop_category_key VARCHAR(30) DEFAULT NULL,
  name VARCHAR(100) NOT NULL,
  subtitle VARCHAR(200) DEFAULT NULL,
  price DECIMAL(10,2) NOT NULL,
  original_price DECIMAL(10,2) DEFAULT NULL,
  main_image VARCHAR(500) DEFAULT NULL,
  images JSON DEFAULT NULL COMMENT '详情轮播图URL数组',
  detail_desc TEXT,
  stock INT NOT NULL DEFAULT 0,
  sales INT NOT NULL DEFAULT 0,
  tag VARCHAR(30) DEFAULT NULL COMMENT '角标文案(如 新品/热卖)',
  is_available TINYINT(1) DEFAULT 1,
  sort_order INT DEFAULT 0,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_shop_cat (shop_category_key),
  KEY idx_shop_avail (is_available),
  CONSTRAINT fk_shop_product_cat FOREIGN KEY (shop_category_key)
    REFERENCES shop_categories(`key`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shop_favorites (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  shop_product_id INT UNSIGNED NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_user_product (user_id, shop_product_id),
  KEY idx_fav_user (user_id),
  CONSTRAINT fk_fav_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_fav_product FOREIGN KEY (shop_product_id)
    REFERENCES shop_products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Phase 2 预留（本期不写业务，仅建表）
CREATE TABLE IF NOT EXISTS shop_orders (
  id VARCHAR(20) NOT NULL COMMENT 'SH+YYYYMMDD+3位序号',
  user_id INT UNSIGNED NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  paid_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  payment_method ENUM('wechat','balance') DEFAULT NULL,
  status ENUM('pending','paid','shipped','completed','cancelled') NOT NULL DEFAULT 'pending',
  recipient_name VARCHAR(50) DEFAULT NULL,
  recipient_phone VARCHAR(20) DEFAULT NULL,
  recipient_address VARCHAR(255) DEFAULT NULL,
  shipping_company VARCHAR(50) DEFAULT NULL,
  tracking_no VARCHAR(50) DEFAULT NULL,
  note VARCHAR(255) DEFAULT NULL,
  paid_at TIMESTAMP NULL DEFAULT NULL,
  shipped_at TIMESTAMP NULL DEFAULT NULL,
  completed_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_shop_order_user (user_id),
  KEY idx_shop_order_status (status),
  CONSTRAINT fk_shop_order_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shop_order_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id VARCHAR(20) NOT NULL,
  shop_product_id INT UNSIGNED DEFAULT NULL,
  product_name VARCHAR(100) NOT NULL,
  product_image VARCHAR(500) DEFAULT NULL,
  price DECIMAL(10,2) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  subtotal DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_shop_item_order (order_id),
  CONSTRAINT fk_shop_item_order FOREIGN KEY (order_id)
    REFERENCES shop_orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_shop_item_product FOREIGN KEY (shop_product_id)
    REFERENCES shop_products(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
