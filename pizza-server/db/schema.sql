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
    total_spent DECIMAL(10,2) DEFAULT 0.00 COMMENT '累计消费金额',
    member_level VARCHAR(50) DEFAULT 'silver' COMMENT '会员等级key,关联member_tiers.level_key',
    notification_enabled TINYINT(1) DEFAULT 1,
    role ENUM('customer','admin') DEFAULT 'customer',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_openid (openid),
    INDEX idx_member_level (member_level),
    INDEX idx_points (points),
    INDEX idx_total_spent (total_spent)
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
-- 13. banners
-- =============================================
CREATE TABLE IF NOT EXISTS banners (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    image_url VARCHAR(500) NOT NULL,
    title VARCHAR(100) DEFAULT '',
    subtitle VARCHAR(200) DEFAULT '',
    tag VARCHAR(30) DEFAULT '',
    link_type ENUM('product','none') DEFAULT 'none',
    link_product_id INT UNSIGNED NULL,
    sort_order INT DEFAULT 0,
    is_active TINYINT(1) DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_active_sort (is_active, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 14. coupon_templates
-- =============================================
CREATE TABLE IF NOT EXISTS coupon_templates (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    `desc` VARCHAR(200) DEFAULT '',
    category ENUM('redeem','discount') NOT NULL DEFAULT 'discount',
    `value` VARCHAR(100) DEFAULT '',
    discount_type ENUM('free_redeem','buy_one_get_one','free_delivery','half_price','fixed_amount') DEFAULT 'fixed_amount',
    discount_value VARCHAR(100) DEFAULT '',
    min_spend DECIMAL(10,2) DEFAULT 0.00,
    valid_days INT DEFAULT 30,
    color VARCHAR(7) DEFAULT '#D32F2F',
    use_tip VARCHAR(300) DEFAULT '',
    is_active TINYINT(1) DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 15. member_tiers
-- =============================================
CREATE TABLE IF NOT EXISTS member_tiers (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    level_key VARCHAR(50) NOT NULL UNIQUE COMMENT '唯一标识,如 silver/gold/rose_gold/platinum/diamond',
    name VARCHAR(50) NOT NULL COMMENT '等级名称,如 银卡会员',
    level_index INT UNSIGNED NOT NULL UNIQUE COMMENT '等级序号,升序排列 1-5',
    min_spent DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT '最低累计消费金额(元)',
    discount_rate DECIMAL(4,2) NOT NULL DEFAULT 1.00 COMMENT '折扣率,0.95=95折',
    points_reward_rate DECIMAL(4,2) NOT NULL DEFAULT 1.00 COMMENT '积分倍率,1.00=1元1分',
    birthday_gift VARCHAR(200) DEFAULT '' COMMENT '生日礼物描述',
    coupon_value DECIMAL(10,2) DEFAULT 0.00 COMMENT '升级奖励优惠券面值(元)',
    accent_color VARCHAR(7) DEFAULT '#c0c0c0' COMMENT '等级主题色 hex',
    bg_start_color VARCHAR(30) DEFAULT 'rgba(60,60,65,0.88)' COMMENT '卡片渐变起始色',
    bg_end_color VARCHAR(30) DEFAULT 'rgba(25,25,30,0.95)' COMMENT '卡片渐变结束色',
    is_active TINYINT(1) DEFAULT 1 COMMENT '是否启用',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_level_index (level_index),
    INDEX idx_min_spent (min_spent),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO member_tiers (level_key, name, level_index, min_spent, discount_rate, points_reward_rate, birthday_gift, coupon_value, accent_color, bg_start_color, bg_end_color) VALUES
('silver',    '银卡会员',   1,     0.00, 1.00, 1.00, '生日当月享9折优惠一次',         0.00, '#c0c0c0', 'rgba(60,60,65,0.88)',  'rgba(25,25,30,0.95)'),
('gold',      '金卡会员',   2,   200.00, 0.98, 1.00, '生日当月享8折优惠一次',         5.00, '#f2ca50', 'rgba(45,42,33,0.88)',  'rgba(17,14,7,0.95)'),
('rose_gold', '玫瑰金会员', 3,  1000.00, 0.95, 1.20, '生日当月享7折优惠+专属礼物',   10.00, '#e0a2a2', 'rgba(50,35,35,0.88)',  'rgba(20,15,15,0.95)'),
('platinum',  '铂金会员',   4,  3000.00, 0.90, 1.50, '生日当月享6折优惠+上门配送',   20.00, '#b4bed2', 'rgba(35,40,50,0.88)',  'rgba(15,17,25,0.95)'),
('diamond',   '钻石会员',   5, 10000.00, 0.85, 2.00, '生日当月享5折优惠+专属客服',   50.00, '#82c8f0', 'rgba(20,35,50,0.88)',  'rgba(10,15,25,0.95)');

-- =============================================
-- 16. dietary_restrictions
-- =============================================
CREATE TABLE IF NOT EXISTS dietary_restrictions (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `key` VARCHAR(30) NOT NULL UNIQUE,
    label VARCHAR(30) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
