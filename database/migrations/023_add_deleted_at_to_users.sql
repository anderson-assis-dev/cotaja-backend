-- Migration: Add deleted_at column to users table for soft delete
ALTER TABLE users ADD COLUMN deleted_at DATETIME NULL DEFAULT NULL;

CREATE INDEX idx_users_deleted_at ON users (deleted_at);
