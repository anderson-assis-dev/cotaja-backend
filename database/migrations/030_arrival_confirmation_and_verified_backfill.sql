-- Confirmacao de chegada do prestador.
--
-- O endpoint /auth/verify-security-code ja validava o codigo, o rastreio ativo
-- e a proximidade de 3 km, mas respondia sucesso sem gravar nada. O front lia
-- `arrival_confirmed_at` para marcar a etapa "Chegada confirmada" na linha do
-- tempo, e a coluna nunca existiu, entao a confirmacao se perdia a cada
-- recarregamento e nao havia registro para auditoria.
ALTER TABLE orders
  ADD COLUMN arrival_confirmed_at DATETIME NULL
    COMMENT 'Momento em que o cliente confirmou a chegada pelo codigo do prestador'
    AFTER schedule_confirmed_by_provider,
  ADD COLUMN arrival_confirmed_distance_km DECIMAL(6,2) NULL
    COMMENT 'Distancia entre o prestador e o endereco no instante da confirmacao'
    AFTER arrival_confirmed_at;

-- Selo de perfil verificado.
--
-- `is_verified` entrou na migration 026 com default 0 e nunca foi escrito por
-- nenhum ponto do codigo, embora seja lido no card de proposta e no status da
-- assinatura. Quem ja passou pela checagem de antecedentes e pela prova de
-- vida passa a contar como verificado.
UPDATE users
  SET is_verified = 1
  WHERE profile_type = 'provider'
    AND criminal_check = 1
    AND liveness_verified = 1
    AND is_verified = 0;
