ALTER TABLE users
  ADD COLUMN mother_name VARCHAR(255) NULL AFTER phone,
  ADD COLUMN birth_date DATE NULL AFTER mother_name;
