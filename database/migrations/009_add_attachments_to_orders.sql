-- Migration: Add attachments column to orders table
-- Created: 2025-10-05

ALTER TABLE orders
ADD COLUMN attachments JSON NULL COMMENT 'Array of attachment files (photos, videos, documents)';

-- Example structure:
-- [
--   {
--     "filename": "IMG_20250105_123456.jpg",
--     "original_name": "foto-da-parede.jpg",
--     "path": "uploads/teste_teste.com/pintura_de_casa/IMG_20250105_123456.jpg",
--     "mime_type": "image/jpeg",
--     "size": 1024000,
--     "type": "image",
--     "uploaded_at": "2025-01-05T12:34:56.000Z"
--   }
-- ]
