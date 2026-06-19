-- 用户生日字段迁移
-- 幂等：检查列是否存在再添加

DROP PROCEDURE IF EXISTS add_birthday;
DELIMITER ;;
CREATE PROCEDURE add_birthday()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'users'
      AND column_name = 'birthday'
  ) THEN
    ALTER TABLE users ADD COLUMN birthday DATE NULL DEFAULT NULL COMMENT '用户生日' AFTER bio;
  END IF;
END;;
DELIMITER ;

CALL add_birthday();
DROP PROCEDURE IF EXISTS add_birthday;
