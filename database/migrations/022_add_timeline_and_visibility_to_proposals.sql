-- Migration 022: Add accepted_at timestamp and view_count to proposals
-- accepted_at: timestamp preciso de quando a proposta foi aceita (para timeline)
-- view_count: contador de visualizações do cliente (para métricas de visibilidade)

ALTER TABLE `proposals`
  ADD COLUMN `accepted_at` TIMESTAMP NULL DEFAULT NULL AFTER `status`,
  ADD COLUMN `view_count` INT NOT NULL DEFAULT 0 AFTER `accepted_at`;
