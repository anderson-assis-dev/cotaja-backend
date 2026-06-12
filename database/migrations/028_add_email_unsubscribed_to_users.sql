-- Permite que o usuário cancele a inscrição dos e-mails de notificação/marketing.
ALTER TABLE users
  ADD COLUMN email_unsubscribed TINYINT(1) NOT NULL DEFAULT 0 AFTER fcm_token;
