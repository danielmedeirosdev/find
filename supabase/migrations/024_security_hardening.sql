-- Security hardening: remove anonymous PII reads and expose only scoped RPCs.
-- Apply this migration together with the client changes that use these RPCs.

BEGIN;

-- Public availability remains readable, but only through this PII-free view.
CREATE OR REPLACE VIEW public.public_booking_slots
WITH (security_invoker = false, security_barrier = true)
AS
SELECT
  b.shop_id,
  b.barber_id,
  b.date,
  b.time,
  COALESCE(b.duration_minutes, 30) AS duration_minutes
FROM public.bookings b
JOIN public.shops s ON s.id = b.shop_id
WHERE s.subscription_status != 'blocked'
  AND b.date >= CURRENT_DATE
  AND (b.status IS NULL OR b.status NOT IN ('cancelled', 'no_show'));

REVOKE ALL ON public.public_booking_slots FROM PUBLIC;
GRANT SELECT ON public.public_booking_slots TO anon, authenticated;

-- Canonical Brazilian phone used only inside trusted functions.
CREATE OR REPLACE FUNCTION public.normalize_br_phone(p_phone TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
RETURNS NULL ON NULL INPUT
SET search_path = ''
AS $$
  SELECT CASE
    WHEN length(v) IN (12, 13) AND left(v, 2) = '55' THEN substring(v FROM 3)
    ELSE v
  END
  FROM (SELECT regexp_replace(p_phone, '[^0-9]', '', 'g') AS v) d;
$$;

REVOKE ALL ON FUNCTION public.normalize_br_phone(TEXT) FROM PUBLIC;

-- Phone-scoped lookup; never exposes customer/pet notes or medical details.
CREATE OR REPLACE FUNCTION public.lookup_pet_customer(
  p_shop_id UUID,
  p_phone TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_phone TEXT := public.normalize_br_phone(p_phone);
  v_customer public.shop_customers%ROWTYPE;
  v_pets JSONB := '[]'::jsonb;
BEGIN
  IF v_phone IS NULL OR length(v_phone) NOT BETWEEN 10 AND 11 THEN
    RAISE EXCEPTION 'Telefone inválido';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.shops s
    WHERE s.id = p_shop_id
      AND s.segment = 'pet'
      AND s.subscription_status != 'blocked'
  ) THEN
    RAISE EXCEPTION 'Estabelecimento inválido';
  END IF;

  SELECT sc.*
  INTO v_customer
  FROM public.shop_customers sc
  WHERE sc.shop_id = p_shop_id
    AND public.normalize_br_phone(sc.phone) = v_phone
  LIMIT 1;

  IF v_customer.id IS NULL THEN
    RETURN jsonb_build_object('customer', NULL, 'pets', '[]'::jsonb);
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'shop_id', p.shop_id,
        'customer_id', p.customer_id,
        'name', p.name,
        'photo_url', p.photo_url,
        'species', p.species,
        'breed', p.breed,
        'size', p.size
      )
      ORDER BY p.name
    ),
    '[]'::jsonb
  )
  INTO v_pets
  FROM public.pets p
  WHERE p.shop_id = p_shop_id
    AND p.customer_id = v_customer.id;

  RETURN jsonb_build_object(
    'customer', jsonb_build_object(
      'id', v_customer.id,
      'shop_id', v_customer.shop_id,
      'name', v_customer.name,
      'phone', v_phone
    ),
    'pets', v_pets
  );
END;
$$;

REVOKE ALL ON FUNCTION public.lookup_pet_customer(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_pet_customer(UUID, TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.upsert_pet_customer(
  p_shop_id UUID,
  p_phone TEXT,
  p_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_phone TEXT := public.normalize_br_phone(p_phone);
  v_name TEXT := trim(COALESCE(p_name, ''));
  v_customer public.shop_customers%ROWTYPE;
BEGIN
  IF v_phone IS NULL OR length(v_phone) NOT BETWEEN 10 AND 11 THEN
    RAISE EXCEPTION 'Telefone inválido';
  END IF;
  IF length(v_name) NOT BETWEEN 2 AND 120 THEN
    RAISE EXCEPTION 'Nome inválido';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.shops s
    WHERE s.id = p_shop_id
      AND s.segment = 'pet'
      AND s.subscription_status != 'blocked'
  ) THEN
    RAISE EXCEPTION 'Estabelecimento inválido';
  END IF;

  SELECT sc.*
  INTO v_customer
  FROM public.shop_customers sc
  WHERE sc.shop_id = p_shop_id
    AND public.normalize_br_phone(sc.phone) = v_phone
  LIMIT 1;

  IF v_customer.id IS NULL THEN
    INSERT INTO public.shop_customers (shop_id, name, phone)
    VALUES (p_shop_id, v_name, v_phone)
    ON CONFLICT (shop_id, phone) DO NOTHING;

    SELECT sc.*
    INTO v_customer
    FROM public.shop_customers sc
    WHERE sc.shop_id = p_shop_id
      AND public.normalize_br_phone(sc.phone) = v_phone
    LIMIT 1;
  END IF;

  RETURN jsonb_build_object(
    'id', v_customer.id,
    'shop_id', v_customer.shop_id,
    'name', v_customer.name,
    'phone', v_phone
  );
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_pet_customer(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_pet_customer(UUID, TEXT, TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_pet_for_customer(
  p_shop_id UUID,
  p_phone TEXT,
  p_name TEXT,
  p_size TEXT,
  p_breed TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_phone TEXT := public.normalize_br_phone(p_phone);
  v_name TEXT := trim(COALESCE(p_name, ''));
  v_breed TEXT := NULLIF(trim(COALESCE(p_breed, '')), '');
  v_customer_id UUID;
  v_pet public.pets%ROWTYPE;
BEGIN
  IF v_phone IS NULL OR length(v_phone) NOT BETWEEN 10 AND 11 THEN
    RAISE EXCEPTION 'Telefone inválido';
  END IF;
  IF length(v_name) NOT BETWEEN 1 AND 80 THEN
    RAISE EXCEPTION 'Nome do pet inválido';
  END IF;
  IF p_size NOT IN ('pequeno', 'medio', 'grande') THEN
    RAISE EXCEPTION 'Porte inválido';
  END IF;
  IF v_breed IS NOT NULL AND length(v_breed) > 80 THEN
    RAISE EXCEPTION 'Raça inválida';
  END IF;

  SELECT sc.id
  INTO v_customer_id
  FROM public.shop_customers sc
  JOIN public.shops s ON s.id = sc.shop_id
  WHERE sc.shop_id = p_shop_id
    AND s.segment = 'pet'
    AND s.subscription_status != 'blocked'
    AND public.normalize_br_phone(sc.phone) = v_phone
  LIMIT 1;

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Cliente não encontrado';
  END IF;

  IF (
    SELECT count(*) FROM public.pets p
    WHERE p.shop_id = p_shop_id AND p.customer_id = v_customer_id
  ) >= 20 THEN
    RAISE EXCEPTION 'Limite de pets atingido';
  END IF;

  INSERT INTO public.pets (shop_id, customer_id, name, size, breed, species)
  VALUES (p_shop_id, v_customer_id, v_name, p_size, v_breed, 'cao')
  RETURNING * INTO v_pet;

  RETURN jsonb_build_object(
    'id', v_pet.id,
    'shop_id', v_pet.shop_id,
    'customer_id', v_pet.customer_id,
    'name', v_pet.name,
    'photo_url', v_pet.photo_url,
    'species', v_pet.species,
    'breed', v_pet.breed,
    'size', v_pet.size
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_pet_for_customer(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_pet_for_customer(UUID, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

-- Validated booking creation replaces direct anonymous INSERT/SELECT.
CREATE OR REPLACE FUNCTION public.create_public_booking(
  p_shop_id UUID,
  p_barber_id UUID,
  p_client_name TEXT,
  p_client_phone TEXT,
  p_date DATE,
  p_time TIME,
  p_pet_id UUID DEFAULT NULL,
  p_shop_customer_id UUID DEFAULT NULL,
  p_duration_minutes INT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_phone TEXT := public.normalize_br_phone(p_client_phone);
  v_name TEXT := trim(COALESCE(p_client_name, ''));
  v_notes TEXT := NULLIF(trim(COALESCE(p_notes, '')), '');
  v_segment TEXT;
  v_booking_id UUID;
BEGIN
  IF length(v_name) NOT BETWEEN 2 AND 120 THEN
    RAISE EXCEPTION 'Nome inválido';
  END IF;
  IF v_phone IS NULL OR length(v_phone) NOT BETWEEN 10 AND 11 THEN
    RAISE EXCEPTION 'Telefone inválido';
  END IF;
  IF p_date < CURRENT_DATE OR p_date > CURRENT_DATE + 365 THEN
    RAISE EXCEPTION 'Data inválida';
  END IF;
  IF p_duration_minutes IS NOT NULL AND p_duration_minutes NOT BETWEEN 15 AND 720 THEN
    RAISE EXCEPTION 'Duração inválida';
  END IF;
  IF v_notes IS NOT NULL AND length(v_notes) > 1000 THEN
    RAISE EXCEPTION 'Observação muito longa';
  END IF;

  SELECT s.segment
  INTO v_segment
  FROM public.shops s
  JOIN public.barbers b ON b.shop_id = s.id
  WHERE s.id = p_shop_id
    AND b.id = p_barber_id
    AND s.subscription_status != 'blocked';

  IF v_segment IS NULL THEN
    RAISE EXCEPTION 'Estabelecimento ou profissional inválido';
  END IF;

  IF (
    SELECT count(*)
    FROM public.bookings b
    WHERE b.shop_id = p_shop_id
      AND public.normalize_br_phone(b.client_phone) = v_phone
      AND b.created_at > now() - interval '10 minutes'
  ) >= 3 THEN
    RAISE EXCEPTION 'Muitas tentativas. Aguarde alguns minutos';
  END IF;

  IF v_segment = 'pet' THEN
    IF p_pet_id IS NULL OR p_shop_customer_id IS NULL THEN
      RAISE EXCEPTION 'Cliente e pet são obrigatórios';
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM public.shop_customers sc
      JOIN public.pets p ON p.customer_id = sc.id AND p.shop_id = sc.shop_id
      WHERE sc.id = p_shop_customer_id
        AND sc.shop_id = p_shop_id
        AND p.id = p_pet_id
        AND public.normalize_br_phone(sc.phone) = v_phone
    ) THEN
      RAISE EXCEPTION 'Cliente ou pet inválido';
    END IF;
  ELSE
    p_pet_id := NULL;
    p_shop_customer_id := NULL;
  END IF;

  INSERT INTO public.bookings (
    shop_id,
    barber_id,
    client_id,
    client_name,
    client_phone,
    date,
    time,
    pet_id,
    shop_customer_id,
    duration_minutes,
    notes,
    status
  ) VALUES (
    p_shop_id,
    p_barber_id,
    auth.uid(),
    v_name,
    v_phone,
    p_date,
    p_time,
    p_pet_id,
    p_shop_customer_id,
    p_duration_minutes,
    v_notes,
    'scheduled'
  )
  RETURNING id INTO v_booking_id;

  RETURN v_booking_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_public_booking(
  UUID, UUID, TEXT, TEXT, DATE, TIME, UUID, UUID, INT, TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_public_booking(
  UUID, UUID, TEXT, TEXT, DATE, TIME, UUID, UUID, INT, TEXT
) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.finalize_public_booking(
  p_booking_id UUID,
  p_phone TEXT,
  p_service_ids UUID[] DEFAULT '{}'::UUID[],
  p_pet_ids UUID[] DEFAULT '{}'::UUID[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_phone TEXT := public.normalize_br_phone(p_phone);
  v_booking public.bookings%ROWTYPE;
  v_service_count INT;
  v_pet_count INT;
  v_pet_names TEXT;
BEGIN
  SELECT b.*
  INTO v_booking
  FROM public.bookings b
  WHERE b.id = p_booking_id
    AND public.normalize_br_phone(b.client_phone) = v_phone
    AND b.created_at > now() - interval '30 minutes'
  FOR UPDATE;

  IF v_booking.id IS NULL THEN
    RAISE EXCEPTION 'Agendamento inválido';
  END IF;
  IF COALESCE(cardinality(p_service_ids), 0) > 20
    OR COALESCE(cardinality(p_pet_ids), 0) > 2 THEN
    RAISE EXCEPTION 'Itens demais no agendamento';
  END IF;

  SELECT count(DISTINCT s.id)
  INTO v_service_count
  FROM public.services s
  WHERE s.id = ANY(COALESCE(p_service_ids, '{}'::UUID[]))
    AND s.shop_id = v_booking.shop_id
    AND s.is_active;

  IF v_service_count <> COALESCE(cardinality(p_service_ids), 0) THEN
    RAISE EXCEPTION 'Serviço inválido';
  END IF;

  IF COALESCE(cardinality(p_pet_ids), 0) > 0 THEN
    SELECT count(DISTINCT p.id), string_agg(DISTINCT p.name, ' · ')
    INTO v_pet_count, v_pet_names
    FROM public.pets p
    WHERE p.id = ANY(p_pet_ids)
      AND p.shop_id = v_booking.shop_id
      AND p.customer_id = v_booking.shop_customer_id;

    IF v_pet_count <> cardinality(p_pet_ids) THEN
      RAISE EXCEPTION 'Pet inválido';
    END IF;
  END IF;

  INSERT INTO public.booking_services (booking_id, service_id)
  SELECT p_booking_id, sid
  FROM unnest(COALESCE(p_service_ids, '{}'::UUID[])) sid
  ON CONFLICT DO NOTHING;

  INSERT INTO public.booking_pets (booking_id, pet_id)
  SELECT p_booking_id, pid
  FROM unnest(COALESCE(p_pet_ids, '{}'::UUID[])) pid
  ON CONFLICT DO NOTHING;

  IF NOT EXISTS (
    SELECT 1 FROM public.notifications n
    WHERE n.booking_id = p_booking_id AND n.kind = 'new_booking'
  ) THEN
    INSERT INTO public.notifications (shop_id, audience, kind, title, body, booking_id)
    VALUES (
      v_booking.shop_id,
      'owner',
      'new_booking',
      'Novo agendamento',
      concat_ws(
        ' · ',
        NULLIF(v_pet_names, ''),
        v_booking.client_name,
        to_char(v_booking.date, 'DD/MM/YYYY') || ' ' || to_char(v_booking.time, 'HH24:MI')
      ),
      p_booking_id
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_public_booking(UUID, TEXT, UUID[], UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_public_booking(UUID, TEXT, UUID[], UUID[]) TO anon, authenticated;

-- Receipt requires knowledge of the booking phone and exposes only that booking.
CREATE OR REPLACE FUNCTION public.get_booking_receipt(
  p_booking_id UUID,
  p_phone TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_phone TEXT := public.normalize_br_phone(p_phone);
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'id', b.id,
    'shop_id', b.shop_id,
    'barber_id', b.barber_id,
    'client_id', b.client_id,
    'client_name', b.client_name,
    'client_phone', b.client_phone,
    'date', b.date,
    'time', b.time,
    'status', b.status,
    'duration_minutes', b.duration_minutes,
    'notes', b.notes,
    'shops', jsonb_build_object(
      'name', s.name,
      'address', s.address,
      'phone', s.phone,
      'segment', s.segment
    ),
    'barbers', jsonb_build_object('name', br.name),
    'pets', CASE
      WHEN p.id IS NULL THEN NULL
      ELSE jsonb_build_object('name', p.name, 'size', p.size)
    END,
    'booking_services', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'service_id', bs.service_id,
          'services', jsonb_build_object(
            'id', svc.id,
            'shop_id', svc.shop_id,
            'name', svc.name,
            'price', svc.price,
            'duration_minutes', svc.duration_minutes
          )
        )
      )
      FROM public.booking_services bs
      JOIN public.services svc ON svc.id = bs.service_id
      WHERE bs.booking_id = b.id
    ), '[]'::jsonb)
  )
  INTO v_result
  FROM public.bookings b
  JOIN public.shops s ON s.id = b.shop_id
  JOIN public.barbers br ON br.id = b.barber_id
  LEFT JOIN public.pets p ON p.id = b.pet_id
  WHERE b.id = p_booking_id
    AND public.normalize_br_phone(b.client_phone) = v_phone;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_booking_receipt(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_booking_receipt(UUID, TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_guest_review_eligibility(p_booking_id UUID)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'eligible', b.status = 'completed' AND b.review_status = 'awaiting',
    'shop_name', s.name,
    'pet_name', p.name
  )
  FROM public.bookings b
  JOIN public.shops s ON s.id = b.shop_id
  LEFT JOIN public.pets p ON p.id = b.pet_id
  WHERE b.id = p_booking_id;
$$;

REVOKE ALL ON FUNCTION public.get_guest_review_eligibility(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_guest_review_eligibility(UUID) TO anon, authenticated;

-- Remove broad anonymous table access. Owners and authenticated clients retain
-- their existing scoped policies.
DROP POLICY IF EXISTS "Public can read bookings for availability" ON public.bookings;
DROP POLICY IF EXISTS "Anyone can create bookings on active shops" ON public.bookings;
DROP POLICY IF EXISTS "Public can read booking services" ON public.booking_services;
DROP POLICY IF EXISTS "Anyone can insert booking services" ON public.booking_services;
DROP POLICY IF EXISTS "Public read shop customers for booking" ON public.shop_customers;
DROP POLICY IF EXISTS "Public insert shop customers" ON public.shop_customers;
DROP POLICY IF EXISTS "Public update shop customers" ON public.shop_customers;
DROP POLICY IF EXISTS "Public read pets of active shops" ON public.pets;
DROP POLICY IF EXISTS "Public insert pets" ON public.pets;
DROP POLICY IF EXISTS "Public read own-ish customer packages" ON public.customer_packages;
DROP POLICY IF EXISTS "Public read booking pets" ON public.booking_pets;
DROP POLICY IF EXISTS "Anyone can insert booking pets" ON public.booking_pets;

-- Client-side notification calls are no longer accepted. Trusted DB functions
-- owned by the function owner can still call notify_shop_owner internally.
REVOKE EXECUTE ON FUNCTION public.notify_shop_owner(UUID, TEXT, TEXT, TEXT, UUID)
  FROM anon, authenticated;

COMMIT;
