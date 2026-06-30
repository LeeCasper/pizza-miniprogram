-- =============================================
-- 会员机制迁移脚本
-- 用法: mysql -u root -p pizza < db/migrate_membership.sql
-- =============================================

USE pizza;

-- Step 1: 新增 total_spent 字段
ALTER TABLE users ADD COLUMN total_spent DECIMAL(10,2) DEFAULT 0.00 COMMENT '累计消费金额' AFTER balance;

-- Step 2: 修改 member_level 为 VARCHAR（支持动态等级key）
ALTER TABLE users MODIFY COLUMN member_level VARCHAR(50) DEFAULT 'silver' COMMENT '会员等级key';

-- Step 3: 新增索引
ALTER TABLE users ADD INDEX idx_total_spent (total_spent);

-- Step 4: 回填 total_spent（从非取消订单汇总）
UPDATE users u
SET u.total_spent = COALESCE(
  (SELECT SUM(o.paid_amount) FROM orders o WHERE o.user_id = u.id AND o.status != 'cancelled'),
  0.00
);

-- Step 5: 回填 member_level（根据 total_spent 匹配新等级阈值）
UPDATE users SET member_level = 'silver' WHERE total_spent < 200;
UPDATE users SET member_level = 'gold' WHERE total_spent >= 200 AND total_spent < 1000;
UPDATE users SET member_level = 'rose_gold' WHERE total_spent >= 1000 AND total_spent < 3000;
UPDATE users SET member_level = 'platinum' WHERE total_spent >= 3000 AND total_spent < 10000;
UPDATE users SET member_level = 'diamond' WHERE total_spent >= 10000;

-- Step 6: 创建 member_tiers 表
CREATE TABLE IF NOT EXISTS member_tiers (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    level_key VARCHAR(50) NOT NULL UNIQUE COMMENT '唯一标识',
    name VARCHAR(50) NOT NULL COMMENT '等级名称',
    level_index INT UNSIGNED NOT NULL UNIQUE COMMENT '等级序号',
    min_spent DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT '最低累计消费金额(元)',
    discount_rate DECIMAL(4,2) NOT NULL DEFAULT 1.00 COMMENT '折扣率',
    points_reward_rate DECIMAL(4,2) NOT NULL DEFAULT 1.00 COMMENT '积分倍率',
    birthday_gift VARCHAR(200) DEFAULT '' COMMENT '生日礼物描述',
    coupon_value DECIMAL(10,2) DEFAULT 0.00 COMMENT '升级奖励优惠券面值(元)',
    accent_color VARCHAR(7) DEFAULT '#c0c0c0' COMMENT '等级主题色 hex',
    is_active TINYINT(1) DEFAULT 1 COMMENT '是否启用',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_level_index (level_index),
    INDEX idx_min_spent (min_spent),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Step 7: 插入 5 级种子数据
INSERT INTO member_tiers (level_key, name, level_index, min_spent, discount_rate, points_reward_rate, birthday_gift, coupon_value, accent_color) VALUES
('silver',    '银卡会员',   1,     0.00, 1.00, 1.00, '生日当月享9折优惠一次',         0.00, '#78d2ab'),
('gold',      '金卡会员',   2,   200.00, 0.98, 1.00, '生日当月享8折优惠一次',         5.00, '#8fc5fe'),
('rose_gold', '玫瑰金会员', 3,  1000.00, 0.95, 1.20, '生日当月享7折优惠+专属礼物',   10.00, '#ada1f0'),
('platinum',  '铂金会员',   4,  3000.00, 0.90, 1.50, '生日当月享6折优惠+上门配送',   20.00, '#f8b95c'),
('diamond',   '钻石会员',   5, 10000.00, 0.85, 2.00, '生日当月享5折优惠+专属客服',   50.00, '#ee6155');
