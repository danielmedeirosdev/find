-- FIND PET close-out: guest reviews, payment refs, slots reconcile, package alerts

-- Slots view canônica (duração + status ativos)
CREATE OR REPLACE VIEW public_booking_slots AS
SELECT
  shop_id,
  barber_id,
  date,
  time,
  COALESCE(duration_minutes, 30) AS duration_minutes
FROM bookings
WHERE status IS NULL
   OR status IN ('scheduled', 'confirmed', 'in_progress', 'awaiting_payment');

GRANT SELECT ON public_booking_slots TO anon, authenticated;

-- Referências tokenizadas de pagamento (nunca PAN/CVV)
CREATE TABLE IF NOT EXISTS payment_method_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  shop_customer_id UUID REFERENCES shop_customers(id) ON DELETE SET NULL,
  customer_phone TEXT,
  provider TEXT NOT NULL DEFAULT 'pending',
  provider_customer_ref TEXT,
  provider_payment_method_ref TEXT NOT NULL,
  brand TEXT,
  last4 TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_method_refs_shop ON payment_method_references(shop_id);
CREATE INDEX IF NOT EXISTS idx_payment_method_refs_customer ON payment_method_references(shop_customer_id);

ALTER TABLE payment_method_references ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage payment method refs" ON payment_method_references;
CREATE POLICY "Owners manage payment method refs" ON payment_method_references
  FOR ALL USING (is_shop_owner(shop_id))
  WITH CHECK (is_shop_owner(shop_id));

-- Avaliação por telefone (agendamentos PET sem login)
CREATE OR REPLACE FUNCTION public.submit_guest_review(
  p_booking_id UUID,
  p_phone TEXT,
  p_rating SMALLINT,
  p_comment TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking RECORD;
  v_review_id UUID;
  v_comment TEXT;
  v_digits TEXT;
  v_client_id UUID;
BEGIN
  v_digits := regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g');

  IF length(v_digits) < 10 THEN
    RAISE EXCEPTION 'Informe o WhatsApp usado no agendamento';
  END IF;

  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'A nota deve ser entre 1 e 5';
  END IF;

  v_comment := NULLIF(TRIM(COALESCE(p_comment, '')), '');

  SELECT
    b.id,
    b.shop_id,
    b.barber_id,
    b.client_id,
    b.client_name,
    b.client_phone,
    b.status,
    b.review_status
  INTO v_booking
  FROM bookings b
  WHERE b.id = p_booking_id
  FOR UPDATE;

  IF v_booking.id IS NULL THEN
    RAISE EXCEPTION 'Atendimento não encontrado';
  END IF;

  IF v_booking.status <> 'completed' THEN
    RAISE EXCEPTION 'Só é possível avaliar atendimentos concluídos';
  END IF;

  IF regexp_replace(COALESCE(v_booking.client_phone, ''), '\D', '', 'g') <> v_digits THEN
    RAISE EXCEPTION 'Telefone não confere com o agendamento';
  END IF;

  IF EXISTS (SELECT 1 FROM reviews WHERE booking_id = p_booking_id) THEN
    RAISE EXCEPTION 'Este atendimento já foi avaliado';
  END IF;

  IF v_booking.review_status = 'reviewed' THEN
    RAISE EXCEPTION 'Este atendimento já foi avaliado';
  END IF;

  -- Reusa client logado se já existir; senão cria/acha por telefone
  IF v_booking.client_id IS NOT NULL THEN
    v_client_id := v_booking.client_id;
  ELSE
    SELECT id INTO v_client_id
    FROM clients
    WHERE regexp_replace(COALESCE(phone, ''), '\D', '', 'g') = v_digits
    LIMIT 1;

    IF v_client_id IS NULL THEN
      v_client_id := gen_random_uuid();
      INSERT INTO clients (id, name, phone)
      VALUES (
        v_client_id,
        COALESCE(NULLIF(TRIM(v_booking.client_name), ''), 'Cliente'),
        v_digits
      );
    END IF;

    UPDATE bookings SET client_id = v_client_id WHERE id = p_booking_id;
  END IF;

  INSERT INTO clients (id, name, phone)
  VALUES (
    v_client_id,
    COALESCE(NULLIF(TRIM(v_booking.client_name), ''), 'Cliente'),
    v_digits
  )
  ON CONFLICT (id) DO UPDATE
  SET phone = COALESCE(clients.phone, EXCLUDED.phone);

  INSERT INTO reviews (
    booking_id, shop_id, barber_id, client_id, rating, comment
  ) VALUES (
    p_booking_id,
    v_booking.shop_id,
    v_booking.barber_id,
    v_client_id,
    p_rating,
    v_comment
  )
  RETURNING id INTO v_review_id;

  UPDATE bookings SET review_status = 'reviewed' WHERE id = p_booking_id;

  PERFORM notify_shop_owner(
    v_booking.shop_id,
    'review_received',
    'Nova avaliação',
    'Nota ' || p_rating::text || ' recebida.',
    p_booking_id
  );

  RETURN v_review_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_guest_review(UUID, TEXT, SMALLINT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_guest_review(UUID, TEXT, SMALLINT, TEXT) TO anon, authenticated;

-- Alerta de pacote perto do fim (ao debitar)
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
  v_remaining INT;
  v_pet TEXT;
BEGIN
  SELECT cp.shop_id, cp.used_sessions, cp.total_sessions, cp.status, cp.expires_at, p.name
  INTO v_shop_id, v_used, v_total, v_status, v_expires, v_pet
  FROM customer_packages cp
  LEFT JOIN pets p ON p.id = cp.pet_id
  WHERE cp.id = p_customer_package_id
  FOR UPDATE OF cp;

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

  v_remaining := v_total - (v_used + 1);
  IF v_remaining <= 2 THEN
    PERFORM notify_shop_owner(
      v_shop_id,
      'package_low',
      'Pacote perto do fim',
      COALESCE(v_pet, 'Pet') || ' — restam ' || v_remaining::text || ' sessão(ões).',
      p_booking_id
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_package_session(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_package_session(UUID, UUID, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
