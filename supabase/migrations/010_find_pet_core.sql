-- FIND PET core: multi-segment + pets + duration by size

ALTER TABLE shops ADD COLUMN IF NOT EXISTS segment TEXT NOT NULL DEFAULT 'barbershop';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'shops_segment_check'
  ) THEN
    ALTER TABLE shops ADD CONSTRAINT shops_segment_check
      CHECK (segment IN ('barbershop', 'pet'));
  END IF;
END $$;

-- Clientes da loja (telefone, sem exigir login FIND)
CREATE TABLE IF NOT EXISTS shop_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shop_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_shop_customers_shop ON shop_customers(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_customers_phone ON shop_customers(shop_id, phone);

-- Pets
CREATE TABLE IF NOT EXISTS pets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES shop_customers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  photo_url TEXT,
  species TEXT NOT NULL DEFAULT 'cao',
  breed TEXT,
  size TEXT NOT NULL DEFAULT 'medio'
    CHECK (size IN ('pequeno', 'medio', 'grande')),
  weight_kg NUMERIC,
  birth_date DATE,
  sex TEXT CHECK (sex IS NULL OR sex IN ('macho', 'femea')),
  notes TEXT,
  behavior TEXT,
  special_needs TEXT,
  allergies TEXT,
  preferences TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pets_shop ON pets(shop_id);
CREATE INDEX IF NOT EXISTS idx_pets_customer ON pets(customer_id);

-- Duração (e preço opcional) por porte
CREATE TABLE IF NOT EXISTS service_size_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  size TEXT NOT NULL CHECK (size IN ('pequeno', 'medio', 'grande')),
  duration_minutes INT NOT NULL CHECK (duration_minutes > 0),
  price NUMERIC,
  UNIQUE (service_id, size)
);

CREATE INDEX IF NOT EXISTS idx_service_size_rules_service ON service_size_rules(service_id);

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pet_id UUID REFERENCES pets(id) ON DELETE SET NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS shop_customer_id UUID REFERENCES shop_customers(id) ON DELETE SET NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS duration_minutes INT;

-- View pública de slots (sem PII) com duração real
CREATE OR REPLACE VIEW public_booking_slots AS
SELECT
  shop_id,
  barber_id,
  date,
  time,
  COALESCE(duration_minutes, 30) AS duration_minutes
FROM bookings
WHERE status IS NULL OR status IN ('scheduled', 'in_progress');

GRANT SELECT ON public_booking_slots TO anon, authenticated;

-- RLS
ALTER TABLE shop_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE pets ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_size_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage shop customers" ON shop_customers;
CREATE POLICY "Owners manage shop customers" ON shop_customers
  FOR ALL USING (is_shop_owner(shop_id))
  WITH CHECK (is_shop_owner(shop_id));

DROP POLICY IF EXISTS "Public read shop customers for booking" ON shop_customers;
CREATE POLICY "Public read shop customers for booking" ON shop_customers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM shops s
      WHERE s.id = shop_customers.shop_id
        AND s.subscription_status != 'blocked'
    )
  );

DROP POLICY IF EXISTS "Public insert shop customers" ON shop_customers;
CREATE POLICY "Public insert shop customers" ON shop_customers
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM shops s
      WHERE s.id = shop_customers.shop_id
        AND s.subscription_status != 'blocked'
    )
  );

DROP POLICY IF EXISTS "Public update shop customers" ON shop_customers;
CREATE POLICY "Public update shop customers" ON shop_customers
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM shops s
      WHERE s.id = shop_customers.shop_id
        AND s.subscription_status != 'blocked'
    )
  );

DROP POLICY IF EXISTS "Owners manage pets" ON pets;
CREATE POLICY "Owners manage pets" ON pets
  FOR ALL USING (is_shop_owner(shop_id))
  WITH CHECK (is_shop_owner(shop_id));

DROP POLICY IF EXISTS "Public read pets of active shops" ON pets;
CREATE POLICY "Public read pets of active shops" ON pets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM shops s
      WHERE s.id = pets.shop_id AND s.subscription_status != 'blocked'
    )
  );

DROP POLICY IF EXISTS "Public insert pets" ON pets;
CREATE POLICY "Public insert pets" ON pets
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM shops s
      WHERE s.id = pets.shop_id AND s.subscription_status != 'blocked'
    )
  );

DROP POLICY IF EXISTS "Owners manage size rules" ON service_size_rules;
CREATE POLICY "Owners manage size rules" ON service_size_rules
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM services svc
      WHERE svc.id = service_size_rules.service_id
        AND is_shop_owner(svc.shop_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM services svc
      WHERE svc.id = service_size_rules.service_id
        AND is_shop_owner(svc.shop_id)
    )
  );

DROP POLICY IF EXISTS "Public read size rules" ON service_size_rules;
CREATE POLICY "Public read size rules" ON service_size_rules
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM services svc
      JOIN shops s ON s.id = svc.shop_id
      WHERE svc.id = service_size_rules.service_id
        AND s.subscription_status != 'blocked'
    )
  );

-- Signup: aceita segment no metadata
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

NOTIFY pgrst, 'reload schema';
