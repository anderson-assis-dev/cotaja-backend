-- Migration: Add 'stopped' status to orders table
-- Date: 2025-01-01
-- Description: Allow orders to be paused (stopped) by the creator

ALTER TABLE orders MODIFY COLUMN status ENUM('open','in_progress','completed','cancelled','stopped') DEFAULT 'open';
