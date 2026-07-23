-- Liveness (anti-robô) — campos opcionais, não obrigatórios.
-- Registros já existentes ficam com liveness_verified = 0 e o app ainda não
-- atualizado continua funcionando (nenhuma coluna nova é obrigatória em
-- INSERT/UPDATE).
ALTER TABLE users
  ADD COLUMN liveness_verified TINYINT(1) NOT NULL DEFAULT 0 AFTER security_code,
  ADD COLUMN liveness_score DECIMAL(5,4) NULL AFTER liveness_verified,
  ADD COLUMN liveness_verified_at DATETIME NULL AFTER liveness_score,
  ADD COLUMN liveness_image_base64 LONGTEXT NULL AFTER liveness_verified_at;
