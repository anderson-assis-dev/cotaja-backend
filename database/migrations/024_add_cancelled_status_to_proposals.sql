-- Migration: Add 'cancelled' status to proposals table
ALTER TABLE proposals MODIFY COLUMN status ENUM('pending','accepted','rejected','withdrawn','cancelled') DEFAULT 'pending';
