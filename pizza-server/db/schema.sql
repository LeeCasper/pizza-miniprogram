-- =============================================
-- 王姐手工披萨 — Database Schema
-- MySQL 8.0+
-- =============================================

CREATE DATABASE IF NOT EXISTS pizza
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE pizza;

-- =============================================
-- 1. users
-- =============================================
CREATE TABLE IF NOT EXISTS users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    openid VARCHAR(64) NOT NULL UNIQUE,
    unionid VARCHAR(64) NULL,
    session_key VARCHAR(64) NULL,
    name VARCHAR(50) DEFAULT '披萨爱好者',
    avatar VARCHAR(500) DEFAULT '',
    bio VARCHAR(200) DEFAULT '享受美味每一天',
    phone VARCHAR(20) DEFAULT '',
    points INT UNSIGNED DEFAULT 0,
    balance DECIMAL(10,2) DEFAULT 0.00,
    member_level ENUM('normal','gold','platinum','diamond') DEFAULT 'normal',
    notification_enabled TINYINT(1) DEFAULT 1,
    role ENUM('customer','admin') DEFAULT 'customer',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_openid (openid),
    INDEX idx_member_level (member_level),
    INDEX idx_points (points)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 2. categories
-- =============================================
CREATE TABLE IF NOT EXISTS categories (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `key` VARCHAR(30) NOT NULL UNIQUE,
    name VARCHAR(50) NOT NULL,
    icon VARCHAR(300) DEFAULT '',
    sort_order INT DEFAULT 0,
    is_active TINYINT(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 3. products
-- =============================================
CREATE TABLE IF NOT EXISTS products (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    category_key VARCHAR(30) NOT NULL,
    name VARCHAR(100) NOT NULL,
    `desc` VARCHAR(200) DEFAULT '',
    detail_desc TEXT,
    price DECIMAL(10,2) NOT NULL,
    image VARCHAR(500) DEFAULT '',
    tag VARCHAR(30) DEFAULT '',
    size_desc VARCHAR(50) DEFAULT '',
    ingredients JSON DEFAULT NULL,
    is_available TINYINT(1) DEFAULT 1,
    sort_order INT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_key) REFERENCES categories(`key`),
    INDEX idx_category (category_key),
    INDEX idx_available (is_available)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 4. cart_items
-- =============================================
CREATE TABLE IF NOT EXISTS cart_items (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    product_id INT UNSIGNED NOT NULL,
    quantity INT UNSIGNED NOT NULL DEFAULT 1,
    restrictions JSON DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    UNIQUE KEY uk_user_product (user_id, product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 5. orders
-- =============================================
CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(20) PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    status ENUM('waiting','preparing','completed','cancelled') DEFAULT 'waiting',
    total DECIMAL(10,2) NOT NULL,
    discount_amount DECIMAL(10,2) DEFAULT 0.00,
    paid_amount DECIMAL(10,2) DEFAULT 0.00,
    pickup_code VARCHAR(10) NOT NULL,
    store_name VARCHAR(100) DEFAULT '爱家店',
    coupon_used_id INT UNSIGNED NULL,
    note VARCHAR(500) DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_user (user_id),
    INDEX idx_status (status),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 6. order_items
-- =============================================
CREATE TABLE IF NOT EXISTS order_items (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    order_id VARCHAR(20) NOT NULL,
    product_id INT UNSIGNED NOT NULL,
    product_name VARCHAR(100) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    quantity INT UNSIGNED NOT NULL DEFAULT 1,
    restrictions JSON DEFAULT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id),
    INDEX idx_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 7. addresses
-- =============================================
CREATE TABLE IF NOT EXISTS addresses (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    name VARCHAR(50) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    province VARCHAR(30) DEFAULT '',
    city VARCHAR(30) DEFAULT '',
    district VARCHAR(30) DEFAULT '',
    detail VARCHAR(200) NOT NULL,
    tag VARCHAR(20) DEFAULT '',
    is_default TINYINT(1) DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user (user_id),
    INDEX idx_default (user_id, is_default)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 8. points_products
-- =============================================
CREATE TABLE IF NOT EXISTS points_products (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    `desc` VARCHAR(200) DEFAULT '',
    detail_desc TEXT,
    points INT UNSIGNED NOT NULL,
    image VARCHAR(500) DEFAULT '',
    stock INT DEFAULT -1,
    tag VARCHAR(30) DEFAULT '',
    highlights JSON DEFAULT NULL,
    redeem_type ENUM('coupon','physical') DEFAULT 'coupon',
    coupon_name VARCHAR(100) DEFAULT '',
    coupon_category ENUM('redeem','discount') DEFAULT 'redeem',
    coupon_value VARCHAR(100) DEFAULT '',
    coupon_discount_type ENUM('free_redeem','buy_one_get_one','free_delivery','half_price','fixed_amount') DEFAULT 'free_redeem',
    coupon_discount_value VARCHAR(100) DEFAULT '',
    coupon_min_spend DECIMAL(10,2) DEFAULT 0.00,
    coupon_valid_days INT DEFAULT 30,
    use_tip VARCHAR(300) DEFAULT '',
    is_active TINYINT(1) DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 9. coupons (user's coupons)
-- =============================================
CREATE TABLE IF NOT EXISTS coupons (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    name VARCHAR(100) NOT NULL,
    `desc` VARCHAR(200) DEFAULT '',
    detail_desc TEXT,
    category ENUM('redeem','discount') NOT NULL,
    `value` VARCHAR(100) DEFAULT '',
    source VARCHAR(100) DEFAULT '',
    status ENUM('available','used','expired') DEFAULT 'available',
    code VARCHAR(30) NOT NULL UNIQUE,
    discount_type ENUM('free_redeem','buy_one_get_one','free_delivery','half_price','fixed_amount') NULL,
    discount_value VARCHAR(100) DEFAULT '',
    min_spend DECIMAL(10,2) DEFAULT 0.00,
    redeem_product_name VARCHAR(100) DEFAULT '',
    redeem_product_price DECIMAL(10,2) NULL,
    redeem_product_image VARCHAR(500) DEFAULT '',
    valid_from DATE NOT NULL,
    valid_to DATE NOT NULL,
    used_at DATETIME NULL,
    use_tip VARCHAR(300) DEFAULT '',
    color VARCHAR(7) DEFAULT '#D32F2F',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user (user_id),
    INDEX idx_status (status),
    INDEX idx_category (category),
    INDEX idx_valid (valid_from, valid_to)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 10. points_history
-- =============================================
CREATE TABLE IF NOT EXISTS points_history (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    points_change INT NOT NULL,
    balance_after INT NOT NULL,
    reason VARCHAR(100) NOT NULL,
    reference_id VARCHAR(50) DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user (user_id),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 11. stores
-- =============================================
CREATE TABLE IF NOT EXISTS stores (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    address VARCHAR(300) DEFAULT '',
    phone VARCHAR(20) DEFAULT '',
    latitude DECIMAL(10,7) NULL,
    longitude DECIMAL(10,7) NULL,
    business_hours VARCHAR(100) DEFAULT '10:00-22:00',
    image VARCHAR(500) DEFAULT '',
    `desc` TEXT,
    is_active TINYINT(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 12. admin_users
-- =============================================
CREATE TABLE IF NOT EXISTS admin_users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(50) DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 13. dietary_restrictions
-- =============================================
CREATE TABLE IF NOT EXISTS dietary_restrictions (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `key` VARCHAR(30) NOT NULL UNIQUE,
    label VARCHAR(30) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
