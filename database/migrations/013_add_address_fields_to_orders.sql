-- Migration: Add structured address fields and coordinates to orders table
-- Date: 2026-02-18

-- Add street field
ALTER TABLE `orders` ADD COLUMN `street` VARCHAR(255) DEFAULT NULL AFTER `address`;

-- Add number field
ALTER TABLE `orders` ADD COLUMN `number` VARCHAR(20) DEFAULT NULL AFTER `street`;

-- Add complement field
ALTER TABLE `orders` ADD COLUMN `complement` VARCHAR(255) DEFAULT NULL AFTER `number`;

-- Add neighborhood field
ALTER TABLE `orders` ADD COLUMN `neighborhood` VARCHAR(255) DEFAULT NULL AFTER `complement`;

-- Add city field
ALTER TABLE `orders` ADD COLUMN `city` VARCHAR(255) DEFAULT NULL AFTER `neighborhood`;

-- Add state field
ALTER TABLE `orders` ADD COLUMN `state` VARCHAR(2) DEFAULT NULL AFTER `city`;

-- Add zip_code (CEP) field
ALTER TABLE `orders` ADD COLUMN `zip_code` VARCHAR(10) DEFAULT NULL AFTER `state`;

-- Add latitude field
ALTER TABLE `orders` ADD COLUMN `latitude` DECIMAL(10, 8) DEFAULT NULL AFTER `zip_code`;

-- Add longitude field
ALTER TABLE `orders` ADD COLUMN `longitude` DECIMAL(11, 8) DEFAULT NULL AFTER `latitude`;

-- Add index on coordinates for geospatial queries
ALTER TABLE `orders` ADD INDEX `idx_orders_coordinates` (`latitude`, `longitude`);

-- Add index on zip_code for CEP-based searches
ALTER TABLE `orders` ADD INDEX `idx_orders_zip_code` (`zip_code`);

-- Add index on city for city-based searches
ALTER TABLE `orders` ADD INDEX `idx_orders_city` (`city`);
