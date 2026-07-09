-- Add scheduled pickup time to orders
ALTER TABLE orders ADD COLUMN pickup_time DATETIME DEFAULT NULL AFTER note;
