ALTER TABLE users
  ADD COLUMN security_code VARCHAR(10) NULL AFTER criminal_check_date;

UPDATE users
  SET security_code = RIGHT(phone, 4)
  WHERE phone IS NOT NULL AND LENGTH(phone) >= 4;
