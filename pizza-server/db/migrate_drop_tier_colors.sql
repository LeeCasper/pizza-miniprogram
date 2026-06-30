-- Drop tier color columns (moved to frontend-only)
ALTER TABLE member_tiers DROP COLUMN bg_start_color;
ALTER TABLE member_tiers DROP COLUMN bg_end_color;
ALTER TABLE member_tiers DROP COLUMN accent_color;
