-- Fix signup: create shop/client via trigger (bypasses RLS timing issues)

CREATE UNIQUE INDEX IF NOT EXISTS idx_shops_owner_unique ON shops(owner_user_id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.raw_user_meta_data->>'role' = 'barber' THEN
    INSERT INTO public.shops (owner_user_id, name, subscription_status)
    VALUES (
      NEW.id,
      COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'shop_name'), ''), 'Minha Barbearia'),
      'trial'
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
