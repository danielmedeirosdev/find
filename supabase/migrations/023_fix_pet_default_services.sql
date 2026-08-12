-- Fix signup trigger to honor segment metadata + heal Bark & Mia pet services

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT;
  v_base TEXT;
  v_slug TEXT;
  v_segment TEXT;
  n INT := 1;
BEGIN
  IF NEW.raw_user_meta_data->>'role' = 'barber' THEN
    v_segment := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'segment'), ''), 'barbershop');
    IF v_segment NOT IN ('barbershop', 'pet') THEN
      v_segment := 'barbershop';
    END IF;

    v_name := COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'shop_name'), ''),
      CASE WHEN v_segment = 'pet' THEN 'Meu Pet Shop' ELSE 'Minha Barbearia' END
    );
    v_base := public.slugify(v_name);
    IF v_base IS NULL OR v_base = '' THEN
      v_base := CASE WHEN v_segment = 'pet' THEN 'pet-shop' ELSE 'barbearia' END;
    END IF;
    v_slug := v_base;
    WHILE EXISTS (SELECT 1 FROM shops WHERE slug = v_slug) LOOP
      n := n + 1;
      v_slug := v_base || '-' || n::text;
    END LOOP;

    INSERT INTO public.shops (
      owner_user_id, name, subscription_status, trial_ends_at, slug, segment
    )
    VALUES (
      NEW.id, v_name, 'trial', now() + INTERVAL '30 days', v_slug, v_segment
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

-- Heal: lojas PET que só têm seed de barbearia (Corte / Barba / Corte + Barba)
DO $$
DECLARE
  r RECORD;
  svc_ids UUID[];
  banho_id UUID;
  tosa_id UUID;
  combo_id UUID;
  hidra_id UUID;
BEGIN
  FOR r IN
    SELECT s.id
    FROM shops s
    WHERE s.segment = 'pet'
      AND EXISTS (
        SELECT 1 FROM services svc
        WHERE svc.shop_id = s.id
          AND svc.name IN ('Corte', 'Barba', 'Corte + Barba')
      )
      AND NOT EXISTS (
        SELECT 1 FROM services svc
        WHERE svc.shop_id = s.id
          AND svc.name NOT IN ('Corte', 'Barba', 'Corte + Barba')
      )
  LOOP
    SELECT ARRAY_AGG(id) INTO svc_ids FROM services WHERE shop_id = r.id;
    IF svc_ids IS NOT NULL THEN
      DELETE FROM service_size_rules WHERE service_id = ANY (svc_ids);
      DELETE FROM booking_services WHERE service_id = ANY (svc_ids);
      DELETE FROM services WHERE shop_id = r.id;
    END IF;

    INSERT INTO services (shop_id, name, price, duration_minutes)
    VALUES (r.id, 'Banho', 50, 60)
    RETURNING id INTO banho_id;

    INSERT INTO services (shop_id, name, price, duration_minutes)
    VALUES (r.id, 'Tosa', 60, 90)
    RETURNING id INTO tosa_id;

    INSERT INTO services (shop_id, name, price, duration_minutes)
    VALUES (r.id, 'Banho + Tosa', 100, 120)
    RETURNING id INTO combo_id;

    INSERT INTO services (shop_id, name, price, duration_minutes)
    VALUES (r.id, 'Hidratação', 40, 40)
    RETURNING id INTO hidra_id;

    INSERT INTO service_size_rules (service_id, size, duration_minutes, price)
    VALUES
      (banho_id, 'pequeno', 45, 50),
      (banho_id, 'medio', 60, 50),
      (banho_id, 'grande', 90, 62.5),
      (tosa_id, 'pequeno', 68, 60),
      (tosa_id, 'medio', 90, 60),
      (tosa_id, 'grande', 135, 75),
      (combo_id, 'pequeno', 90, 100),
      (combo_id, 'medio', 120, 100),
      (combo_id, 'grande', 180, 125),
      (hidra_id, 'pequeno', 30, 40),
      (hidra_id, 'medio', 40, 40),
      (hidra_id, 'grande', 60, 50);
  END LOOP;
END $$;

-- Bark & Mia explícito (caso segment ainda não esteja pet, força e aplica seed pet)
DO $$
DECLARE
  shop_uuid UUID;
  svc_ids UUID[];
  banho_id UUID;
  tosa_id UUID;
  combo_id UUID;
BEGIN
  SELECT id INTO shop_uuid FROM shops WHERE slug = 'bark-mia' LIMIT 1;
  IF shop_uuid IS NULL THEN
    RETURN;
  END IF;

  UPDATE shops SET segment = 'pet' WHERE id = shop_uuid AND segment IS DISTINCT FROM 'pet';

  SELECT ARRAY_AGG(id) INTO svc_ids
  FROM services
  WHERE shop_id = shop_uuid
    AND name IN ('Corte', 'Barba', 'Corte + Barba');

  IF svc_ids IS NOT NULL THEN
    DELETE FROM service_size_rules WHERE service_id = ANY (svc_ids);
    DELETE FROM booking_services WHERE service_id = ANY (svc_ids);
    DELETE FROM services WHERE id = ANY (svc_ids);
  END IF;

  -- Só insere placeholders se ainda não houver serviços pet
  IF NOT EXISTS (
    SELECT 1 FROM services WHERE shop_id = shop_uuid AND name IN ('Banho', 'Tosa', 'Banho + Tosa')
  ) THEN
    INSERT INTO services (shop_id, name, price, duration_minutes)
    VALUES (shop_uuid, 'Banho', 50, 60)
    RETURNING id INTO banho_id;

    INSERT INTO services (shop_id, name, price, duration_minutes)
    VALUES (shop_uuid, 'Tosa', 60, 90)
    RETURNING id INTO tosa_id;

    INSERT INTO services (shop_id, name, price, duration_minutes)
    VALUES (shop_uuid, 'Banho + Tosa', 100, 120)
    RETURNING id INTO combo_id;

    INSERT INTO service_size_rules (service_id, size, duration_minutes, price)
    VALUES
      (banho_id, 'pequeno', 45, 50),
      (banho_id, 'medio', 60, 50),
      (banho_id, 'grande', 90, 62.5),
      (tosa_id, 'pequeno', 68, 60),
      (tosa_id, 'medio', 90, 60),
      (tosa_id, 'grande', 135, 75),
      (combo_id, 'pequeno', 90, 100),
      (combo_id, 'medio', 120, 100),
      (combo_id, 'grande', 180, 125);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
