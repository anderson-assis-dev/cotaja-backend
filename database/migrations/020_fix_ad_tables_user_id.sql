SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `ads`;
DROP TABLE IF EXISTS `ad_purchases`;
DROP TABLE IF EXISTS `user_search_categories`;

CREATE TABLE IF NOT EXISTS `ad_purchases` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` bigint(20) unsigned NOT NULL,
  `package_id` INT NOT NULL,
  `stripe_payment_intent_id` VARCHAR(255) NULL,
  `amount_cents` INT NOT NULL,
  `remaining_ads` INT NOT NULL,
  `ad_type` ENUM('single','general','targeted') NOT NULL,
  `status` ENUM('pending','paid','failed','refunded') NOT NULL DEFAULT 'pending',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_ad_purchases_user` (`user_id`),
  INDEX `idx_ad_purchases_status` (`status`),
  CONSTRAINT `fk_ad_purchases_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ad_purchases_package` FOREIGN KEY (`package_id`) REFERENCES `ad_packages` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ads` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `purchase_id` INT NOT NULL,
  `user_id` bigint(20) unsigned NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `message` TEXT NOT NULL,
  `ad_type` ENUM('single','general','targeted') NOT NULL,
  `target_categories` JSON NULL,
  `target_radius_km` INT NULL DEFAULT 50,
  `scheduled_date` DATE NOT NULL,
  `scheduled_time` TIME NOT NULL,
  `status` ENUM('scheduled','sent','failed','cancelled') NOT NULL DEFAULT 'scheduled',
  `sent_count` INT NOT NULL DEFAULT 0,
  `sent_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_ads_user` (`user_id`),
  INDEX `idx_ads_status` (`status`),
  INDEX `idx_ads_scheduled` (`scheduled_date`, `scheduled_time`),
  CONSTRAINT `fk_ads_purchase` FOREIGN KEY (`purchase_id`) REFERENCES `ad_purchases` (`id`),
  CONSTRAINT `fk_ads_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `user_search_categories` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` bigint(20) unsigned NOT NULL,
  `category` VARCHAR(100) NOT NULL,
  `search_count` INT NOT NULL DEFAULT 1,
  `last_searched_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `idx_user_search_cat` (`user_id`, `category`),
  INDEX `idx_search_category` (`category`),
  CONSTRAINT `fk_user_search_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
