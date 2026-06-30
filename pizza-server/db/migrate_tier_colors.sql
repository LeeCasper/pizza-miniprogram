-- Update tier card colors to the new palette
UPDATE member_tiers SET accent_color = '#78d2ab', bg_start_color = '#78d2ab', bg_end_color = '#5a9e80' WHERE level_key = 'silver';
UPDATE member_tiers SET accent_color = '#8fc5fe', bg_start_color = '#8fc5fe', bg_end_color = '#6b94be' WHERE level_key = 'gold';
UPDATE member_tiers SET accent_color = '#ada1f0', bg_start_color = '#ada1f0', bg_end_color = '#8279b4' WHERE level_key = 'rose_gold';
UPDATE member_tiers SET accent_color = '#f8b95c', bg_start_color = '#f8b95c', bg_end_color = '#ba8b45' WHERE level_key = 'platinum';
UPDATE member_tiers SET accent_color = '#ee6155', bg_start_color = '#ee6155', bg_end_color = '#b34940' WHERE level_key = 'diamond';
