-- FIND PET operations: packages, notifications, statuses, no-show policy
-- Pré-requisito: garante o core do 010 (caso ainda não tenha sido aplicado neste projeto)

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

CREATE OR REPLACE VIEW public_booking_slots AS
SELECT
  shop_id,
  barber_id,
  date,
  time,
  COALESCE(duration_minutes, 30) AS duration_minutes
FROM bookings
WHERE status IS NULL OR status IN ('scheduled', 'confirmed', 'in_progress', 'awaiting_payment');

GRANT SELECT ON public_booking_slots TO anon, authenticated;

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

-- Statuses alinhados ao produto PET/barbearia
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_status_check
  CHECK (status IN (
    'scheduled',
    'confirmed',
    'in_progress',
    'awaiting_payment',
    'completed',
    'no_show',
    'cancelled'
  ));

-- ============================================================
-- Pacotes (ex.: banho de pacote)
-- ============================================================
CREATE TABLE IF NOT EXISTS service_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  total_sessions INT NOT NULL CHECK (total_sessions > 0),
  price NUMERIC NOT NULL DEFAULT 0 CHECK (price >= 0),
  validity_days INT CHECK (validity_days IS NULL OR validity_days > 0),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_packages_shop ON service_packages(shop_id);

CREATE TABLE IF NOT EXISTS customer_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  package_id UUID NOT NULL REFERENCES service_packages(id) ON DELETE RESTRICT,
  customer_id UUID NOT NULL REFERENCES shop_customers(id) ON DELETE CASCADE,
  pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  total_sessions INT NOT NULL CHECK (total_sessions > 0),
  used_sessions INT NOT NULL DEFAULT 0 CHECK (used_sessions >= 0),
  expires_at DATE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'exhausted', 'expired', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT customer_packages_used_lte_total CHECK (used_sessions <= total_sessions)
);

CREATE INDEX IF NOT EXISTS idx_customer_packages_shop ON customer_packages(shop_id);
CREATE INDEX IF NOT EXISTS idx_customer_packages_pet ON customer_packages(pet_id);
CREATE INDEX IF NOT EXISTS idx_customer_packages_customer ON customer_packages(customer_id);

CREATE TABLE IF NOT EXISTS package_usages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_package_id UUID NOT NULL REFERENCES customer_packages(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  note TEXT,
  used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_package_usages_pkg ON package_usages(customer_package_id);

-- ============================================================
-- Notificações (profissional)
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  audience TEXT NOT NULL DEFAULT 'owner'
    CHECK (audience IN ('owner', 'customer')),
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_shop ON notifications(shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(shop_id) WHERE read_at IS NULL;

-- ============================================================
-- Política de no-show + aceite (sem cartão bruto)
-- ============================================================
CREATE TABLE IF NOT EXISTS no_show_policies (
  shop_id UUID PRIMARY KEY REFERENCES shops(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  hours_before INT NOT NULL DEFAULT 24 CHECK (hours_before >= 0),
  fee_amount NUMERIC NOT NULL DEFAULT 0 CHECK (fee_amount >= 0),
  terms_text TEXT NOT NULL DEFAULT '',
  terms_version TEXT NOT NULL DEFAULT '1',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS terms_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  shop_customer_id UUID REFERENCES shop_customers(id) ON DELETE SET NULL,
  phone TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  terms_text TEXT NOT NULL,
  fee_amount NUMERIC NOT NULL DEFAULT 0,
  hours_before INT NOT NULL DEFAULT 24,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- referência tokenizada futura do gateway (nunca PAN/CVV)
  payment_provider_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_terms_acceptances_shop ON terms_acceptances(shop_id);
CREATE INDEX IF NOT EXISTS idx_terms_acceptances_booking ON terms_acceptances(booking_id);

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_package_id UUID REFERENCES customer_packages(id) ON DELETE SET NULL;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE service_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE package_usages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE no_show_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE terms_acceptances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage service packages" ON service_packages;
CREATE POLICY "Owners manage service packages" ON service_packages
  FOR ALL USING (is_shop_owner(shop_id)) WITH CHECK (is_shop_owner(shop_id));

DROP POLICY IF EXISTS "Public read active service packages" ON service_packages;
CREATE POLICY "Public read active service packages" ON service_packages
  FOR SELECT USING (
    active AND EXISTS (
      SELECT 1 FROM shops s WHERE s.id = service_packages.shop_id AND s.subscription_status != 'blocked'
    )
  );

DROP POLICY IF EXISTS "Owners manage customer packages" ON customer_packages;
CREATE POLICY "Owners manage customer packages" ON customer_packages
  FOR ALL USING (is_shop_owner(shop_id)) WITH CHECK (is_shop_owner(shop_id));

DROP POLICY IF EXISTS "Public read own-ish customer packages" ON customer_packages;
CREATE POLICY "Public read own-ish customer packages" ON customer_packages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM shops s WHERE s.id = customer_packages.shop_id AND s.subscription_status != 'blocked'
    )
  );

DROP POLICY IF EXISTS "Owners manage package usages" ON package_usages;
CREATE POLICY "Owners manage package usages" ON package_usages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM customer_packages cp
      WHERE cp.id = package_usages.customer_package_id AND is_shop_owner(cp.shop_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM customer_packages cp
      WHERE cp.id = package_usages.customer_package_id AND is_shop_owner(cp.shop_id)
    )
  );

DROP POLICY IF EXISTS "Owners manage notifications" ON notifications;
CREATE POLICY "Owners manage notifications" ON notifications
  FOR ALL USING (is_shop_owner(shop_id)) WITH CHECK (is_shop_owner(shop_id));

DROP POLICY IF EXISTS "Owners manage no show policies" ON no_show_policies;
CREATE POLICY "Owners manage no show policies" ON no_show_policies
  FOR ALL USING (is_shop_owner(shop_id)) WITH CHECK (is_shop_owner(shop_id));

DROP POLICY IF EXISTS "Public read no show policies" ON no_show_policies;
CREATE POLICY "Public read no show policies" ON no_show_policies
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM shops s WHERE s.id = no_show_policies.shop_id AND s.subscription_status != 'blocked'
    )
  );

DROP POLICY IF EXISTS "Owners read terms acceptances" ON terms_acceptances;
CREATE POLICY "Owners read terms acceptances" ON terms_acceptances
  FOR SELECT USING (is_shop_owner(shop_id));

DROP POLICY IF EXISTS "Public insert terms acceptances" ON terms_acceptances;
CREATE POLICY "Public insert terms acceptances" ON terms_acceptances
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM shops s WHERE s.id = terms_acceptances.shop_id AND s.subscription_status != 'blocked'
    )
  );

-- ============================================================
-- RPCs
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_shop_owner(
  p_shop_id UUID,
  p_kind TEXT,
  p_title TEXT,
  p_body TEXT DEFAULT NULL,
  p_booking_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM shops s
    WHERE s.id = p_shop_id AND s.subscription_status != 'blocked'
  ) THEN
    RAISE EXCEPTION 'Estabelecimento inválido';
  END IF;

  INSERT INTO notifications (shop_id, audience, kind, title, body, booking_id)
  VALUES (p_shop_id, 'owner', p_kind, p_title, p_body, p_booking_id)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_shop_owner(UUID, TEXT, TEXT, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_shop_owner(UUID, TEXT, TEXT, TEXT, UUID) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.consume_package_session(
  p_customer_package_id UUID,
  p_booking_id UUID DEFAULT NULL,
  p_note TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop_id UUID;
  v_used INT;
  v_total INT;
  v_status TEXT;
  v_expires DATE;
BEGIN
  SELECT shop_id, used_sessions, total_sessions, status, expires_at
  INTO v_shop_id, v_used, v_total, v_status, v_expires
  FROM customer_packages
  WHERE id = p_customer_package_id
  FOR UPDATE;

  IF v_shop_id IS NULL THEN
    RAISE EXCEPTION 'Pacote não encontrado';
  END IF;

  IF NOT is_shop_owner(v_shop_id) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  IF v_status <> 'active' THEN
    RAISE EXCEPTION 'Pacote não está ativo';
  END IF;

  IF v_expires IS NOT NULL AND v_expires < CURRENT_DATE THEN
    UPDATE customer_packages SET status = 'expired' WHERE id = p_customer_package_id;
    RAISE EXCEPTION 'Pacote expirado';
  END IF;

  IF v_used >= v_total THEN
    UPDATE customer_packages SET status = 'exhausted' WHERE id = p_customer_package_id;
    RAISE EXCEPTION 'Pacote sem sessões restantes';
  END IF;

  UPDATE customer_packages
  SET
    used_sessions = used_sessions + 1,
    status = CASE WHEN used_sessions + 1 >= total_sessions THEN 'exhausted' ELSE status END
  WHERE id = p_customer_package_id;

  INSERT INTO package_usages (customer_package_id, booking_id, note)
  VALUES (p_customer_package_id, p_booking_id, NULLIF(TRIM(COALESCE(p_note, '')), ''));

  IF p_booking_id IS NOT NULL THEN
    UPDATE bookings SET customer_package_id = p_customer_package_id WHERE id = p_booking_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_package_session(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_package_session(UUID, UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_booking_status(
  p_booking_id UUID,
  p_status TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop_id UUID;
  v_client TEXT;
  v_pet TEXT;
BEGIN
  IF p_status NOT IN ('confirmed', 'in_progress', 'awaiting_payment', 'no_show', 'cancelled', 'scheduled') THEN
    RAISE EXCEPTION 'Status inválido';
  END IF;

  SELECT b.shop_id, b.client_name, p.name
  INTO v_shop_id, v_client, v_pet
  FROM bookings b
  LEFT JOIN pets p ON p.id = b.pet_id
  WHERE b.id = p_booking_id
  FOR UPDATE OF b;

  IF v_shop_id IS NULL THEN
    RAISE EXCEPTION 'Agendamento não encontrado';
  END IF;

  IF NOT is_shop_owner(v_shop_id) THEN
    RAISE EXCEPTION 'Sem permissão para atualizar este agendamento';
  END IF;

  UPDATE bookings SET status = p_status WHERE id = p_booking_id;

  IF p_status = 'no_show' THEN
    PERFORM notify_shop_owner(
      v_shop_id,
      'no_show',
      'Falta registrada',
      COALESCE(v_pet, v_client) || ' marcado como não compareceu.',
      p_booking_id
    );
  ELSIF p_status = 'cancelled' THEN
    PERFORM notify_shop_owner(
      v_shop_id,
      'booking_cancelled',
      'Agendamento cancelado',
      COALESCE(v_pet, v_client) || ' — horário liberado.',
      p_booking_id
    );
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS public.complete_booking(UUID, UUID[], TEXT, NUMERIC);

CREATE OR REPLACE FUNCTION public.complete_booking(
  p_booking_id UUID,
  p_service_ids UUID[],
  p_payment_method TEXT,
  p_amount NUMERIC,
  p_customer_package_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop_id UUID;
  v_client_name TEXT;
  v_client_id UUID;
  v_shop_customer_id UUID;
  v_pet_name TEXT;
BEGIN
  IF p_payment_method IS NULL OR p_payment_method NOT IN ('pix', 'cartao', 'dinheiro') THEN
    RAISE EXCEPTION 'Forma de pagamento inválida';
  END IF;

  IF p_service_ids IS NULL OR array_length(p_service_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Selecione ao menos um serviço';
  END IF;

  SELECT b.shop_id, b.client_name, b.client_id, b.shop_customer_id, p.name
  INTO v_shop_id, v_client_name, v_client_id, v_shop_customer_id, v_pet_name
  FROM bookings b
  LEFT JOIN pets p ON p.id = b.pet_id
  WHERE b.id = p_booking_id
  FOR UPDATE OF b;

  IF v_shop_id IS NULL THEN
    RAISE EXCEPTION 'Agendamento não encontrado';
  END IF;

  IF NOT is_shop_owner(v_shop_id) THEN
    RAISE EXCEPTION 'Sem permissão para finalizar este atendimento';
  END IF;

  UPDATE bookings
  SET
    status = 'completed',
    payment_method = p_payment_method,
    completed_at = now(),
    review_status = CASE
      WHEN v_client_id IS NOT NULL OR v_shop_customer_id IS NOT NULL THEN 'awaiting'
      ELSE 'unavailable'
    END
  WHERE id = p_booking_id;

  DELETE FROM booking_services WHERE booking_id = p_booking_id;

  INSERT INTO booking_services (booking_id, service_id)
  SELECT DISTINCT p_booking_id, sid
  FROM unnest(p_service_ids) AS sid;

  INSERT INTO financial_transactions (
    shop_id, booking_id, type, description, amount, payment_method
  ) VALUES (
    v_shop_id,
    p_booking_id,
    'entrada',
    'Atendimento - ' || COALESCE(v_pet_name || ' / ', '') || v_client_name,
    p_amount,
    p_payment_method
  );

  IF p_customer_package_id IS NOT NULL THEN
    PERFORM consume_package_session(p_customer_package_id, p_booking_id, 'Uso no atendimento');
  END IF;

  PERFORM notify_shop_owner(
    v_shop_id,
    'booking_completed',
    'Atendimento concluído',
    COALESCE(v_pet_name, v_client_name) || ' finalizado.',
    p_booking_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.complete_booking(UUID, UUID[], TEXT, NUMERIC, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_booking(UUID, UUID[], TEXT, NUMERIC, UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.update_booking_status(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_booking_status(UUID, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
