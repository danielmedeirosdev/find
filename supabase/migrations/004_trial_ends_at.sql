-- Período de teste grátis de 30 dias

ALTER TABLE shops ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

-- Barbearias em trial sem data: created_at + 30 dias
UPDATE shops
SET trial_ends_at = created_at + INTERVAL '30 days'
WHERE subscription_status = 'trial' AND trial_ends_at IS NULL;

-- Novos cadastros: trial_ends_at automático
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.raw_user_meta_data->>'role' = 'barber' THEN
    INSERT INTO public.shops (owner_user_id, name, subscription_status, trial_ends_at)
    VALUES (
      NEW.id,
      COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'shop_name'), ''), 'Minha Barbearia'),
      'trial',
      now() + INTERVAL '30 days'
    )
    ON CONFLICT (owner_user_id) DO NOTHING;
  END IF;

  IF NEW.raw_user_meta_data->>'role' = 'client' THEN
    INSERT INTO public.clients (id, name, phone)
    VALUES (
      NEW.id,
      COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''), 'Cliente'),
      NULLIF(TRIM(NEW.raw_user_meta_data->>'phone'), '')
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Bloqueia trials expirados (pode ser chamada via pg_cron ou edge function)
CREATE OR REPLACE FUNCTION public.expire_expired_trials()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected INTEGER;
BEGIN
  UPDATE shops
  SET subscription_status = 'blocked'
  WHERE subscription_status = 'trial'
    AND trial_ends_at IS NOT NULL
    AND trial_ends_at < now();

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

NOTIFY pgrst, 'reload schema';
