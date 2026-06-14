-- Tabela de afiliados
CREATE TABLE IF NOT EXISTS `affiliates` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NULL,
  `name` varchar(255) NOT NULL,
  `code` varchar(50) NOT NULL UNIQUE,
  `email` varchar(255) DEFAULT NULL,
  `instagram` varchar(255) DEFAULT NULL,
  `tier` enum('ambassador','provider','client') DEFAULT 'client',
  `commission_install` decimal(8,2) DEFAULT 0.50,
  `commission_first_order` decimal(8,2) DEFAULT 1.50,
  `commission_premium` decimal(8,2) DEFAULT 2.50,
  `status` enum('active','inactive','pending') DEFAULT 'pending',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_affiliates_code` (`code`),
  KEY `idx_affiliates_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de conversões
CREATE TABLE IF NOT EXISTS `affiliate_conversions` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `affiliate_id` bigint(20) unsigned NOT NULL,
  `referred_user_id` bigint(20) unsigned NOT NULL,
  `event_type` enum('install','first_order','premium') NOT NULL,
  `commission_value` decimal(8,2) NOT NULL,
  `status` enum('pending','approved','paid') DEFAULT 'pending',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `paid_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_conv_affiliate` (`affiliate_id`),
  KEY `idx_conv_user` (`referred_user_id`),
  CONSTRAINT `fk_conv_affiliate` FOREIGN KEY (`affiliate_id`) REFERENCES `affiliates` (`id`),
  CONSTRAINT `fk_conv_user` FOREIGN KEY (`referred_user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Adicionar campos de referral nos usuários
ALTER TABLE `users` ADD COLUMN `ref_code` varchar(50) NULL;
ALTER TABLE `users` ADD COLUMN `referred_by` bigint(20) unsigned NULL;
