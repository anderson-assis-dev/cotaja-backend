ALTER TABLE users
  ADD COLUMN cpf VARCHAR(14) NULL AFTER phone,
  ADD COLUMN criminal_check TINYINT(1) NOT NULL DEFAULT 0 AFTER service_categories,
  ADD COLUMN criminal_check_code VARCHAR(100) NULL AFTER criminal_check,
  ADD COLUMN criminal_check_date DATETIME NULL AFTER criminal_check_code;

ALTER TABLE users ADD UNIQUE INDEX idx_users_cpf (cpf);
