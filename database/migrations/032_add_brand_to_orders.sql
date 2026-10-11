-- Marca de origem do pedido.
--
-- O mesmo backend atende o CotaJa e o Contratae Bahia. Sem guardar de onde o
-- pedido veio, o comprovante e os e-mails saiam sempre com a mesma marca, e um
-- cliente do CotaJa receberia documento do Contratae Bahia.
--
-- A origem e inferida do cabecalho Origin da requisicao que cria o pedido. Os
-- aplicativos nao enviam esse cabecalho e caem no padrao, que e o CotaJa, o que
-- esta correto porque os apps publicados sao do CotaJa.
ALTER TABLE orders
  ADD COLUMN brand VARCHAR(32) NOT NULL DEFAULT 'cotaja'
    COMMENT 'Marca de origem do pedido: cotaja ou contrataebahia'
    AFTER category;

-- Os pedidos existentes ficam como cotaja, que e o default da coluna.
