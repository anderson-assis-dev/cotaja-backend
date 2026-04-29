-- Tabela de afiliados
CREATE TABLE IF NOT EXISTS affiliates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255),
  instagram VARCHAR(255),
  tier ENUM('ambassador', 'provider', 'client') DEFAULT 'client',
  commission_install DECIMAL(8,2) DEFAULT 1.00,
  commission_first_order DECIMAL(8,2) DEFAULT 3.00,
  commission_premium DECIMAL(8,2) DEFAULT 5.00,
  status ENUM('active', 'inactive', 'pending') DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de conversões
CREATE TABLE IF NOT EXISTS affiliate_conversions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  affiliate_id INT NOT NULL,
  referred_user_id INT NOT NULL,
  event_type ENUM('install','first_order','premium') NOT NULL,
  commission_value DECIMAL(8,2) NOT NULL,
  status ENUM('pending','approved','paid') DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  paid_at DATETIME NULL,
  FOREIGN KEY (affiliate_id) REFERENCES affiliates(id),
  FOREIGN KEY (referred_user_id) REFERENCES users(id)
);

-- Adicionar campos de referral nos usuários
ALTER TABLE users ADD COLUMN IF NOT EXISTS ref_code VARCHAR(50) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by INT NULL;
