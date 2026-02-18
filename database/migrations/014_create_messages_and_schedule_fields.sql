-- Migration: Create messages table and add scheduling/cancel fields to orders
-- Date: 2026-02-18

-- Messages table for chat between client and provider
CREATE TABLE IF NOT EXISTS `messages` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `order_id` INT NOT NULL,
  `sender_id` VARCHAR(36) NOT NULL,
  `receiver_id` VARCHAR(36) NOT NULL,
  `content` TEXT NOT NULL,
  `read_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_messages_order_id` (`order_id`),
  INDEX `idx_messages_sender_id` (`sender_id`),
  INDEX `idx_messages_receiver_id` (`receiver_id`),
  INDEX `idx_messages_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add scheduling and cancellation fields to orders
ALTER TABLE `orders` ADD COLUMN `scheduled_date` DATETIME NULL AFTER `auction_ends_at`;
ALTER TABLE `orders` ADD COLUMN `schedule_confirmed_by_client` TINYINT(1) DEFAULT 0 AFTER `scheduled_date`;
ALTER TABLE `orders` ADD COLUMN `schedule_confirmed_by_provider` TINYINT(1) DEFAULT 0 AFTER `schedule_confirmed_by_client`;
ALTER TABLE `orders` ADD COLUMN `schedule_reminder_1d_sent` TINYINT(1) DEFAULT 0 AFTER `schedule_confirmed_by_provider`;
ALTER TABLE `orders` ADD COLUMN `schedule_reminder_1h_sent` TINYINT(1) DEFAULT 0 AFTER `schedule_reminder_1d_sent`;
ALTER TABLE `orders` ADD COLUMN `cancel_reason` TEXT NULL AFTER `schedule_reminder_1h_sent`;
ALTER TABLE `orders` ADD COLUMN `cancelled_by` VARCHAR(36) NULL AFTER `cancel_reason`;
