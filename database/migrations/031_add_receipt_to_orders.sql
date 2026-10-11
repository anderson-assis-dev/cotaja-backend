-- Comprovante de servico.
--
-- Ao concluir, o pedido ganha um codigo publico de verificacao. Com ele o
-- cidadao tem prova do que foi contratado, o prestador tem documento de
-- comprovacao de renda, que hoje lhe falta, e quem receber o comprovante pode
-- conferir a autenticidade sem precisar de conta na plataforma.
--
-- O codigo e aleatorio e nao sequencial, para que ninguem consiga varrer
-- comprovantes de terceiros trocando um numero.
ALTER TABLE orders
  ADD COLUMN receipt_code VARCHAR(20) NULL
    COMMENT 'Codigo publico de verificacao do comprovante'
    AFTER arrival_confirmed_distance_km,
  ADD COLUMN receipt_issued_at DATETIME NULL
    COMMENT 'Momento em que o comprovante foi emitido'
    AFTER receipt_code;

ALTER TABLE orders
  ADD UNIQUE INDEX uniq_orders_receipt_code (receipt_code);
