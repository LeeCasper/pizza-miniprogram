-- =============================================
-- 默认头像管理 (Default Avatars)
-- 用于新用户登录时随机分配默认头像
-- =============================================
CREATE TABLE IF NOT EXISTS default_avatars (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    url VARCHAR(500) NOT NULL COMMENT '头像图片URL',
    sort_order INT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
