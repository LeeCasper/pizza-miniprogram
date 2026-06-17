-- Fix: Add missing growth value for orders 20260617006 & 20260617007
-- These were paid via WeChat but total_spent was not updated due to
-- a timing issue during v1.8.2 deployment.

-- Add the missing 2.00 to user 1's total_spent
UPDATE users
SET total_spent = total_spent + 2.00,
    member_level = CASE
        WHEN (total_spent + 2.00) >= 10000 THEN 'diamond'
        WHEN (total_spent + 2.00) >= 3000 THEN 'platinum'
        WHEN (total_spent + 2.00) >= 1000 THEN 'rose_gold'
        WHEN (total_spent + 2.00) >= 200 THEN 'gold'
        ELSE 'silver'
    END
WHERE id = 1;

-- Record points for the missed orders
INSERT INTO points_history (user_id, points_change, balance_after, reason, reference_id)
SELECT 1, 2, points, '订单消费(补)', '20260617006+07'
FROM users WHERE id = 1;
