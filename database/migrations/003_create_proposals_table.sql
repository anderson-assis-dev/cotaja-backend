-- Migration: Create proposals table
-- Date: 2024-01-01 00:00:02

CREATE TABLE IF NOT EXISTS `proposals` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `price` decimal(10,2) NOT NULL,
  `deadline` varchar(100) NOT NULL,
  `description` text NOT NULL,
  `status` enum('pending','accepted','rejected','withdrawn') DEFAULT 'pending',
  `order_id` bigint(20) unsigned NOT NULL,
  `provider_id` bigint(20) unsigned NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_proposals_order_id` (`order_id`),
  KEY `idx_proposals_provider_id` (`provider_id`),
  KEY `idx_proposals_status` (`status`),
  KEY `idx_proposals_created_at` (`created_at`),
  CONSTRAINT `fk_proposals_order_id` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_proposals_provider_id` FOREIGN KEY (`provider_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;