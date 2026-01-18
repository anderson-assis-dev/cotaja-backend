-- Migration: Add device_platform field to users table
-- Date: 2025-10-02

-- Add device_platform column if it doesn't exist
ALTER TABLE `users`
ADD COLUMN IF NOT EXISTS `device_platform` enum('ios','android') DEFAULT NULL
AFTER `fcm_token`;

-- Add index for device_platform for better query performance
ALTER TABLE `users`
ADD INDEX IF NOT EXISTS `idx_users_device_platform` (`device_platform`);
