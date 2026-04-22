-- Migration: Add premium subscription fields to users table
-- Date: 2026-04-21

ALTER TABLE users
  ADD COLUMN is_premium    TINYINT(1)   NOT NULL DEFAULT 0    AFTER stripe_customer_id,
  ADD COLUMN is_verified   TINYINT(1)   NOT NULL DEFAULT 0    AFTER is_premium,
  ADD COLUMN premium_since DATETIME     NULL                  AFTER is_verified,
  ADD COLUMN premium_until DATETIME     NULL                  AFTER premium_since,
  ADD COLUMN stripe_subscription_id VARCHAR(255) NULL         AFTER premium_until;

ALTER TABLE users ADD INDEX idx_users_is_premium (is_premium);
