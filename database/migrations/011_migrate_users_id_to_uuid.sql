-- Migration: Convert users.id from AUTO_INCREMENT bigint to UUID (CHAR(36))
-- Date: 2025-01-01
-- WARNING: This is a destructive migration. Backup your database first!
-- Run: mysql -u root -p your_database < database/migrations/011_migrate_users_id_to_uuid.sql

-- Step 1: Add UUID column to users table
ALTER TABLE `users` ADD COLUMN `uuid` CHAR(36) NULL AFTER `id`;

-- Step 2: Populate UUIDs for existing users
UPDATE `users` SET `uuid` = UUID() WHERE `uuid` IS NULL;

-- Step 3: Drop foreign keys that reference users.id
ALTER TABLE `orders` DROP FOREIGN KEY `fk_orders_client_id`;
ALTER TABLE `orders` DROP FOREIGN KEY `fk_orders_provider_id`;
ALTER TABLE `proposals` DROP FOREIGN KEY `fk_proposals_provider_id`;
ALTER TABLE `notifications` DROP FOREIGN KEY `fk_notifications_user_id`;
ALTER TABLE `services` DROP FOREIGN KEY `fk_services_provider`;

-- Step 4: Add UUID columns to referencing tables and populate
ALTER TABLE `orders` ADD COLUMN `client_uuid` CHAR(36) NULL AFTER `client_id`;
ALTER TABLE `orders` ADD COLUMN `provider_uuid` CHAR(36) NULL AFTER `provider_id`;
ALTER TABLE `proposals` ADD COLUMN `provider_uuid` CHAR(36) NULL AFTER `provider_id`;
ALTER TABLE `notifications` ADD COLUMN `user_uuid` CHAR(36) NULL AFTER `user_id`;
ALTER TABLE `services` ADD COLUMN `provider_uuid` CHAR(36) NULL AFTER `provider_id`;
ALTER TABLE `sessions` ADD COLUMN `user_uuid` CHAR(36) NULL AFTER `user_id`;

-- Step 5: Populate UUID columns from users.uuid
UPDATE `orders` o JOIN `users` u ON o.client_id = u.id SET o.client_uuid = u.uuid;
UPDATE `orders` o JOIN `users` u ON o.provider_id = u.id SET o.provider_uuid = u.uuid WHERE o.provider_id IS NOT NULL;
UPDATE `proposals` p JOIN `users` u ON p.provider_id = u.id SET p.provider_uuid = u.uuid;
UPDATE `notifications` n JOIN `users` u ON n.user_id = u.id SET n.user_uuid = u.uuid;
UPDATE `services` s JOIN `users` u ON s.provider_id = u.id SET s.provider_uuid = u.uuid;
UPDATE `sessions` s JOIN `users` u ON s.user_id = u.id SET s.user_uuid = u.uuid WHERE s.user_id IS NOT NULL;

-- Step 6: Drop old integer columns and rename UUID columns

-- users: drop old id, rename uuid to id
ALTER TABLE `users` DROP PRIMARY KEY;
ALTER TABLE `orders` DROP COLUMN `client_id`;
ALTER TABLE `orders` DROP COLUMN `provider_id`;
ALTER TABLE `proposals` DROP COLUMN `provider_id`;
ALTER TABLE `notifications` DROP COLUMN `user_id`;
ALTER TABLE `services` DROP COLUMN `provider_id`;
ALTER TABLE `sessions` DROP COLUMN `user_id`;
ALTER TABLE `users` DROP COLUMN `id`;

ALTER TABLE `users` CHANGE `uuid` `id` CHAR(36) NOT NULL;
ALTER TABLE `orders` CHANGE `client_uuid` `client_id` CHAR(36) NOT NULL;
ALTER TABLE `orders` CHANGE `provider_uuid` `provider_id` CHAR(36) NULL DEFAULT NULL;
ALTER TABLE `proposals` CHANGE `provider_uuid` `provider_id` CHAR(36) NOT NULL;
ALTER TABLE `notifications` CHANGE `user_uuid` `user_id` CHAR(36) NOT NULL;
ALTER TABLE `services` CHANGE `provider_uuid` `provider_id` CHAR(36) NOT NULL;
ALTER TABLE `sessions` CHANGE `user_uuid` `user_id` CHAR(36) NULL DEFAULT NULL;

-- Step 7: Set primary key on users.id
ALTER TABLE `users` ADD PRIMARY KEY (`id`);

-- Step 8: Recreate foreign keys
ALTER TABLE `orders` ADD CONSTRAINT `fk_orders_client_id` FOREIGN KEY (`client_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;
ALTER TABLE `orders` ADD CONSTRAINT `fk_orders_provider_id` FOREIGN KEY (`provider_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;
ALTER TABLE `proposals` ADD CONSTRAINT `fk_proposals_provider_id` FOREIGN KEY (`provider_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;
ALTER TABLE `notifications` ADD CONSTRAINT `fk_notifications_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;
ALTER TABLE `services` ADD CONSTRAINT `fk_services_provider` FOREIGN KEY (`provider_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

-- Step 9: Add index on sessions.user_id
ALTER TABLE `sessions` ADD INDEX `sessions_user_id_index` (`user_id`);
