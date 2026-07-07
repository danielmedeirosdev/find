-- Adiciona colunas que podem faltar na tabela shops (schema incompleto)

ALTER TABLE shops ADD COLUMN IF NOT EXISTS slogan TEXT;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS hours_text TEXT;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS cpf_cnpj TEXT;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS asaas_customer_id TEXT;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'trial';

-- Garante constraint do status (ignora se já existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'shops_subscription_status_check'
  ) THEN
    ALTER TABLE shops ADD CONSTRAINT shops_subscription_status_check
      CHECK (subscription_status IN ('trial', 'active', 'blocked'));
  END IF;
END $$;

-- Atualiza cache do PostgREST
NOTIFY pgrst, 'reload schema';
