-- Migration: Add avatar_base64 and activate columns to users table
-- Date: 2026-02-16

-- Add avatar_base64 column (LONGTEXT to store base64 image data)
ALTER TABLE `users` ADD COLUMN `avatar_base64` LONGTEXT DEFAULT NULL AFTER `device_platform`;

-- Add activate column (0 = inactive, 1 = active, default 0)
ALTER TABLE `users` ADD COLUMN `activate` TINYINT(1) NOT NULL DEFAULT 0 AFTER `avatar_base64`;

-- Add activation_token column for email verification links
ALTER TABLE `users` ADD COLUMN `activation_token` VARCHAR(255) DEFAULT NULL AFTER `activate`;

-- Add index on activation_token for fast lookups
ALTER TABLE `users` ADD INDEX `idx_users_activation_token` (`activation_token`);
