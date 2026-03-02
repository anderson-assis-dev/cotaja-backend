CREATE TABLE IF NOT EXISTS `ad_packages` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `slug` VARCHAR(50) NOT NULL UNIQUE,
  `price_cents` INT NOT NULL,
  `ad_count` INT NOT NULL,
  `ad_type` ENUM('single','general','targeted') NOT NULL,
  `description` TEXT NULL,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `ad_packages` (`name`, `slug`, `price_cents`, `ad_count`, `ad_type`, `description`) VALUES
('Anúncio Único', 'single-5', 500, 1, 'single', 'Um anúncio avulso enviado para todos os usuários.'),
('2 Anúncios Gerais', 'general-15', 1500, 2, 'general', 'Dois anúncios gerais enviados para todos sem filtro.'),
('3 Anúncios Categorizados', 'targeted-25', 2500, 3, 'targeted', 'Três anúncios enviados apenas para usuários próximos e com interesse na sua categoria.');

CREATE TABLE IF NOT EXISTS `ad_purchases` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` VARCHAR(36) NOT NULL,
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
  `user_id` VARCHAR(36) NOT NULL,
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
  `user_id` VARCHAR(36) NOT NULL,
  `category` VARCHAR(100) NOT NULL,
  `search_count` INT NOT NULL DEFAULT 1,
  `last_searched_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `idx_user_search_cat` (`user_id`, `category`),
  INDEX `idx_search_category` (`category`),
  CONSTRAINT `fk_user_search_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
