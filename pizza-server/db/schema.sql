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
    payment_method ENUM('wechat','balance','coupon') NULL COMMENT '支付方式(NULL=未支付)',
    transaction_id VARCHAR(64) NULL COMMENT '微信支付交易号',
    paid_at DATETIME NULL COMMENT '支付完成时间',
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
    product_id INT UNSIGNED NULL,
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
    discount_type ENUM('free_redeem','buy_one_get_one','free_delivery','half_price','fixed_amount','percentage') NULL,
    discount_value VARCHAR(100) DEFAULT '',
    min_spend DECIMAL(10,2) DEFAULT 0.00,
    template_id INT UNSIGNED NULL,
    max_discount DECIMAL(10,2) NULL,
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
    pickup_notice TEXT,
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
    link_shop_product_id INT UNSIGNED NULL,
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
    discount_type ENUM('free_redeem','buy_one_get_one','free_delivery','half_price','fixed_amount','percentage') DEFAULT 'fixed_amount',
    discount_value VARCHAR(100) DEFAULT '',
    min_spend DECIMAL(10,2) DEFAULT 0.00,
    valid_days INT DEFAULT 30,
    color VARCHAR(7) DEFAULT '#D32F2F',
    use_tip VARCHAR(300) DEFAULT '',
    claimable TINYINT(1) NOT NULL DEFAULT 0,
    total_stock INT UNSIGNED NULL,
    claimed_count INT UNSIGNED NOT NULL DEFAULT 0,
    per_user_limit INT UNSIGNED NOT NULL DEFAULT 1,
    claim_period ENUM('none','weekly','monthly') NOT NULL DEFAULT 'none',
    min_member_level INT NOT NULL DEFAULT 0,
    max_discount DECIMAL(10,2) NULL,
    image VARCHAR(500) DEFAULT '' COMMENT '模板封面图',
    redeem_product_name VARCHAR(100) DEFAULT '' COMMENT '兑换商品名称',
    redeem_product_price DECIMAL(10,2) NULL COMMENT '兑换商品价格',
    redeem_product_image VARCHAR(500) DEFAULT '' COMMENT '兑换商品图片',
    product_id INT UNSIGNED NULL COMMENT '关联商品ID(兑换券可关联商品自动填充信息)',
    is_active TINYINT(1) DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 14b. coupon_claims (claim records for claimable templates)
-- =============================================
CREATE TABLE IF NOT EXISTS coupon_claims (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    template_id INT UNSIGNED NOT NULL,
    user_id     INT UNSIGNED NOT NULL,
    coupon_id   INT UNSIGNED NOT NULL,
    period_key  VARCHAR(16)  NOT NULL DEFAULT '',
    claimed_at  DATETIME     DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (template_id) REFERENCES coupon_templates(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)     REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_tpl_user_period (template_id, user_id, period_key)
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
    is_active TINYINT(1) DEFAULT 1 COMMENT '是否启用',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_level_index (level_index),
    INDEX idx_min_spent (min_spent),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO member_tiers (level_key, name, level_index, min_spent, discount_rate, points_reward_rate, birthday_gift, coupon_value) VALUES
('silver',    '银卡会员',   1,     0.00, 1.00, 1.00, '生日当月享9折优惠一次',         0.00),
('gold',      '金卡会员',   2,   200.00, 0.98, 1.00, '生日当月享8折优惠一次',         5.00),
('rose_gold', '玫瑰金会员', 3,  1000.00, 0.95, 1.20, '生日当月享7折优惠+专属礼物',   10.00),
('platinum',  '铂金会员',   4,  3000.00, 0.90, 1.50, '生日当月享6折优惠+上门配送',   20.00),
('diamond',   '钻石会员',   5, 10000.00, 0.85, 2.00, '生日当月享5折优惠+专属客服',   50.00);

-- =============================================
-- 16. dietary_restrictions
-- =============================================
CREATE TABLE IF NOT EXISTS dietary_restrictions (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `key` VARCHAR(30) NOT NULL UNIQUE,
    label VARCHAR(30) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 17. balance_history
-- =============================================
CREATE TABLE IF NOT EXISTS balance_history (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    amount DECIMAL(10,2) NOT NULL COMMENT '充值金额',
    balance_after DECIMAL(10,2) NOT NULL COMMENT '充值后余额',
    type ENUM('recharge','deduct','refund','reward') DEFAULT 'recharge',
    remark VARCHAR(128) DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user (user_id),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 18. payment_records
-- =============================================
CREATE TABLE IF NOT EXISTS payment_records (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    type ENUM('order','recharge','shop_order') NOT NULL COMMENT '支付类型',
    reference_id VARCHAR(64) NOT NULL COMMENT '关联ID(订单号/充值流水号)',
    out_trade_no VARCHAR(64) NOT NULL UNIQUE COMMENT '商户订单号',
    transaction_id VARCHAR(64) NULL COMMENT '微信支付交易号',
    amount DECIMAL(10,2) NOT NULL,
    status ENUM('pending','success','failed','closed') DEFAULT 'pending',
    raw_notify JSON NULL COMMENT '微信回调原始数据',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_user (user_id),
    INDEX idx_out_trade_no (out_trade_no),
    INDEX idx_reference (reference_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 19. system_config
-- =============================================
CREATE TABLE IF NOT EXISTS system_config (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    config_key VARCHAR(64) NOT NULL UNIQUE,
    config_value TEXT NOT NULL,
    description VARCHAR(255) DEFAULT '',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO system_config (config_key, config_value, description) VALUES
('wx_pay_mch_id', '', '微信支付商户号'),
('wx_pay_api_v3_key', '', 'API v3密钥(32位)'),
('wx_pay_cert_serial_no', '', '商户证书序列号'),
('wx_pay_private_key', '', '商户私钥(PEM格式)'),
('wx_pay_platform_cert', '', '微信支付平台证书(PEM格式)'),
('wx_pay_notify_url', 'https://artaides.com/api/v1/pay/notify', '支付回调通知URL');

-- 物流查询(快递100) — 通过管理后台配置，UPSERT 写入
-- logistics_customer: 快递100 customer ID
-- logistics_key: 快递100 API key
-- logistics_enabled: 是否启用 (true/false)

-- =============================================
-- 20. 幸运转盘 (Lucky Wheel)
-- =============================================
CREATE TABLE IF NOT EXISTS lucky_wheel_prizes (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  type ENUM('coupon','points','balance','thanks','again') NOT NULL,
  name VARCHAR(50) NOT NULL,
  weight INT UNSIGNED NOT NULL DEFAULT 1,
  stock INT UNSIGNED NULL,
  awarded_count INT UNSIGNED NOT NULL DEFAULT 0,
  coupon_template_id INT UNSIGNED NULL,
  points_amount INT UNSIGNED NULL,
  balance_amount DECIMAL(10,2) NULL,
  color VARCHAR(16) DEFAULT '#F5C518',
  icon VARCHAR(255) DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (coupon_template_id) REFERENCES coupon_templates(id) ON DELETE SET NULL,
  INDEX idx_active_sort (is_active, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lucky_wheel_draws (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  prize_id INT UNSIGNED NULL,
  prize_type ENUM('coupon','points','balance','thanks','again') NOT NULL,
  prize_name VARCHAR(50) NOT NULL,
  source ENUM('free','points','again') NOT NULL,
  cost_points INT UNSIGNED NOT NULL DEFAULT 0,
  coupon_id INT UNSIGNED NULL,
  points_amount INT UNSIGNED NULL,
  balance_amount DECIMAL(10,2) NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (prize_id) REFERENCES lucky_wheel_prizes(id) ON DELETE SET NULL,
  INDEX idx_user_date (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
  refund_amount DECIMAL(10,2) NULL COMMENT '退款金额',
  refund_reason VARCHAR(200) NULL COMMENT '退款原因',
  refund_status VARCHAR(20) NULL COMMENT '退款状态: processing/success/failed',
  refunded_at DATETIME NULL COMMENT '退款完成时间',
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

CREATE TABLE IF NOT EXISTS shop_refund_records (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id VARCHAR(20) NOT NULL COMMENT '商城订单号 (SH+...)',
  user_id INT UNSIGNED NOT NULL,
  out_refund_no VARCHAR(64) NOT NULL UNIQUE COMMENT '商户退款单号 SR+orderId',
  refund_id VARCHAR(64) NULL COMMENT '微信退款单号',
  transaction_id VARCHAR(64) NULL COMMENT '原微信支付交易号',
  payment_method ENUM('wechat','balance') NOT NULL COMMENT '原支付方式',
  refund_amount DECIMAL(10,2) NOT NULL COMMENT '退款金额',
  reason VARCHAR(200) DEFAULT NULL COMMENT '退款原因',
  status ENUM('pending','processing','success','failed') DEFAULT 'pending' COMMENT '退款状态',
  points_reversed INT DEFAULT 0 COMMENT '已回退积分数',
  total_spent_reversed DECIMAL(10,2) DEFAULT 0 COMMENT '已回退累计消费额',
  raw_notify JSON NULL COMMENT '微信退款回调原始数据',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES shop_orders(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_sr_order (order_id),
  INDEX idx_sr_user (user_id),
  INDEX idx_sr_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
