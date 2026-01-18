-- Migration: Create orders table
-- Date: 2024-01-01 00:00:01

CREATE TABLE IF NOT EXISTS `orders` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `description` text NOT NULL,
  `category` varchar(100) NOT NULL,
  `budget` decimal(10,2) NOT NULL,
  `deadline` int(11) NOT NULL COMMENT 'Number of days',
  `address` text NOT NULL,
  `status` enum('open','in_progress','completed','cancelled') DEFAULT 'open',
  `client_id` bigint(20) unsigned NOT NULL,
  `provider_id` bigint(20) unsigned DEFAULT NULL,
  `accepted_proposal_id` bigint(20) unsigned DEFAULT NULL,
  `auction_started_at` timestamp NULL DEFAULT NULL,
  `auction_ends_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_orders_client_id` (`client_id`),
  KEY `idx_orders_provider_id` (`provider_id`),
  KEY `idx_orders_status` (`status`),
  KEY `idx_orders_category` (`category`),
  KEY `idx_orders_created_at` (`created_at`),
  CONSTRAINT `fk_orders_client_id` FOREIGN KEY (`client_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_orders_provider_id` FOREIGN KEY (`provider_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;