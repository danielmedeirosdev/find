-- Uma avaliação por cliente por estabelecimento (só no 1º atendimento concluído).

-- 0) Remove duplicatas existentes (mantém a avaliação mais antiga de cada cliente na loja)
WITH ranked AS (
  SELECT
    id,
    booking_id,
    ROW_NUMBER() OVER (
      PARTITION BY shop_id, client_id
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.reviews
)
UPDATE public.bookings b
SET review_status = 'unavailable'
FROM ranked r
WHERE b.id = r.booking_id
  AND r.rn > 1
  AND b.review_status = 'reviewed';

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY shop_id, client_id
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.reviews
)
DELETE FROM public.reviews r
USING ranked d
WHERE r.id = d.id
  AND d.rn > 1;

-- 1) Índice único shop + cliente (mantém unique por booking)
CREATE UNIQUE INDEX IF NOT EXISTS reviews_one_per_client_shop_uidx
  ON public.reviews (shop_id, client_id);

-- 2) complete_booking: só o primeiro atendimento do cliente libera avaliação
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
AS $complete_booking$
DECLARE
  v_shop_id UUID;
  v_client_name TEXT;
  v_client_id UUID;
  v_shop_customer_id UUID;
  v_client_phone TEXT;
  v_pet_name TEXT;
  v_phone_digits TEXT;
  v_allow_review BOOLEAN := false;
  v_customer_key TEXT;
BEGIN
  IF p_payment_method IS NULL OR p_payment_method NOT IN ('pix', 'cartao', 'dinheiro') THEN
    RAISE EXCEPTION 'Forma de pagamento inválida';
  END IF;

  IF p_service_ids IS NULL OR array_length(p_service_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Selecione ao menos um serviço';
  END IF;

  SELECT b.shop_id, b.client_name, b.client_id, b.shop_customer_id, b.client_phone, p.name
  INTO v_shop_id, v_client_name, v_client_id, v_shop_customer_id, v_client_phone, v_pet_name
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

  v_phone_digits := regexp_replace(COALESCE(v_client_phone, ''), '[^0-9]', '', 'g');

  IF v_client_id IS NOT NULL THEN
    v_customer_key := 'c:' || v_client_id::text;
  ELSIF v_shop_customer_id IS NOT NULL THEN
    v_customer_key := 's:' || v_shop_customer_id::text;
  ELSIF length(v_phone_digits) >= 10 THEN
    v_customer_key := 'p:' || v_phone_digits;
  ELSE
    v_customer_key := NULL;
  END IF;

  IF v_customer_key IS NOT NULL THEN
    -- Já avaliou este estabelecimento?
    IF EXISTS (
      SELECT 1
      FROM reviews r
      LEFT JOIN clients c ON c.id = r.client_id
      WHERE r.shop_id = v_shop_id
        AND (
          (v_client_id IS NOT NULL AND r.client_id = v_client_id)
          OR (
            length(v_phone_digits) >= 10
            AND regexp_replace(COALESCE(c.phone, ''), '[^0-9]', '', 'g') = v_phone_digits
          )
        )
    ) THEN
      v_allow_review := false;
    -- Já teve um atendimento concluído antes neste lugar? (só o 1º pode avaliar)
    ELSIF EXISTS (
      SELECT 1
      FROM bookings earlier
      WHERE earlier.shop_id = v_shop_id
        AND earlier.id <> p_booking_id
        AND earlier.status = 'completed'
        AND (
          (v_client_id IS NOT NULL AND earlier.client_id = v_client_id)
          OR (v_shop_customer_id IS NOT NULL AND earlier.shop_customer_id = v_shop_customer_id)
          OR (
            length(v_phone_digits) >= 10
            AND regexp_replace(COALESCE(earlier.client_phone, ''), '[^0-9]', '', 'g') = v_phone_digits
          )
        )
    ) THEN
      v_allow_review := false;
    ELSE
      v_allow_review := true;
    END IF;
  END IF;

  UPDATE bookings
  SET
    status = 'completed',
    payment_method = p_payment_method,
    completed_at = now(),
    review_status = CASE
      WHEN v_allow_review THEN 'awaiting'
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
$complete_booking$;

REVOKE ALL ON FUNCTION public.complete_booking(UUID, UUID[], TEXT, NUMERIC, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_booking(UUID, UUID[], TEXT, NUMERIC, UUID) TO authenticated;

-- 3) submit_review (logado): bloqueia 2ª avaliação no mesmo estabelecimento
CREATE OR REPLACE FUNCTION public.submit_review(
  p_booking_id UUID,
  p_rating SMALLINT,
  p_comment TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $submit_review$
DECLARE
  v_user_id UUID := auth.uid();
  v_booking RECORD;
  v_review_id UUID;
  v_comment TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Faça login para avaliar';
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

  IF v_booking.client_id IS NULL OR v_booking.client_id <> v_user_id THEN
    RAISE EXCEPTION 'Você só pode avaliar seus próprios atendimentos';
  END IF;

  IF v_booking.status <> 'completed' THEN
    RAISE EXCEPTION 'Só é possível avaliar atendimentos concluídos';
  END IF;

  IF v_booking.review_status = 'unavailable' THEN
    RAISE EXCEPTION 'Este atendimento não está disponível para avaliação';
  END IF;

  IF EXISTS (SELECT 1 FROM reviews WHERE booking_id = p_booking_id) THEN
    RAISE EXCEPTION 'Este atendimento já foi avaliado';
  END IF;

  IF EXISTS (
    SELECT 1 FROM reviews
    WHERE shop_id = v_booking.shop_id
      AND client_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Você já avaliou este estabelecimento. Só é permitida uma avaliação.';
  END IF;

  IF v_booking.review_status = 'reviewed' THEN
    RAISE EXCEPTION 'Este atendimento já foi avaliado';
  END IF;

  INSERT INTO clients (id, name, phone)
  VALUES (
    v_user_id,
    COALESCE(NULLIF(TRIM(v_booking.client_name), ''), 'Cliente'),
    NULLIF(TRIM(v_booking.client_phone), '')
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO reviews (
    booking_id, shop_id, barber_id, client_id, rating, comment
  ) VALUES (
    p_booking_id,
    v_booking.shop_id,
    v_booking.barber_id,
    v_user_id,
    p_rating,
    v_comment
  )
  RETURNING id INTO v_review_id;

  UPDATE bookings
  SET review_status = 'reviewed'
  WHERE id = p_booking_id;

  -- Fecha qualquer outro awaiting do mesmo cliente neste lugar
  UPDATE bookings
  SET review_status = 'unavailable'
  WHERE shop_id = v_booking.shop_id
    AND id <> p_booking_id
    AND review_status = 'awaiting'
    AND (
      client_id = v_user_id
      OR regexp_replace(COALESCE(client_phone, ''), '[^0-9]', '', 'g')
         = regexp_replace(COALESCE(v_booking.client_phone, ''), '[^0-9]', '', 'g')
    );

  RETURN v_review_id;
END;
$submit_review$;

REVOKE ALL ON FUNCTION public.submit_review(UUID, SMALLINT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_review(UUID, SMALLINT, TEXT) TO authenticated;

-- 4) submit_guest_review: mesma regra por telefone / cliente
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
AS $submit_guest_review$
DECLARE
  v_booking RECORD;
  v_review_id UUID;
  v_comment TEXT;
  v_digits TEXT;
  v_client_id UUID;
BEGIN
  v_digits := regexp_replace(COALESCE(p_phone, ''), '[^0-9]', '', 'g');

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
    RAISE EXCEPTION 'Atendimento nao encontrado';
  END IF;

  IF v_booking.status <> 'completed' THEN
    RAISE EXCEPTION 'So e possivel avaliar atendimentos concluidos';
  END IF;

  IF v_booking.review_status = 'unavailable' THEN
    RAISE EXCEPTION 'Este atendimento nao esta disponivel para avaliacao';
  END IF;

  IF regexp_replace(COALESCE(v_booking.client_phone, ''), '[^0-9]', '', 'g') <> v_digits THEN
    RAISE EXCEPTION 'Telefone nao confere com o agendamento';
  END IF;

  IF EXISTS (SELECT 1 FROM reviews WHERE booking_id = p_booking_id) THEN
    RAISE EXCEPTION 'Este atendimento ja foi avaliado';
  END IF;

  IF v_booking.review_status = 'reviewed' THEN
    RAISE EXCEPTION 'Este atendimento ja foi avaliado';
  END IF;

  IF v_booking.client_id IS NOT NULL THEN
    v_client_id := v_booking.client_id;
  ELSE
    SELECT id INTO v_client_id
    FROM clients
    WHERE regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = v_digits
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

  IF EXISTS (
    SELECT 1 FROM reviews
    WHERE shop_id = v_booking.shop_id
      AND client_id = v_client_id
  ) THEN
    RAISE EXCEPTION 'Voce ja avaliou este estabelecimento. So e permitida uma avaliacao.';
  END IF;

  -- Também bloqueia se já existe review do mesmo telefone neste shop (outro client_id)
  IF EXISTS (
    SELECT 1
    FROM reviews r
    JOIN clients c ON c.id = r.client_id
    WHERE r.shop_id = v_booking.shop_id
      AND regexp_replace(COALESCE(c.phone, ''), '[^0-9]', '', 'g') = v_digits
  ) THEN
    RAISE EXCEPTION 'Voce ja avaliou este estabelecimento. So e permitida uma avaliacao.';
  END IF;

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

  UPDATE bookings
  SET review_status = 'unavailable'
  WHERE shop_id = v_booking.shop_id
    AND id <> p_booking_id
    AND review_status = 'awaiting'
    AND (
      client_id = v_client_id
      OR regexp_replace(COALESCE(client_phone, ''), '[^0-9]', '', 'g') = v_digits
    );

  PERFORM notify_shop_owner(
    v_booking.shop_id,
    'review_received',
    'Nova avaliacao',
    'Nota ' || p_rating::text || ' recebida.',
    p_booking_id
  );

  RETURN v_review_id;
END;
$submit_guest_review$;

REVOKE ALL ON FUNCTION public.submit_guest_review(UUID, TEXT, SMALLINT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_guest_review(UUID, TEXT, SMALLINT, TEXT) TO anon, authenticated;

-- 5) Backfill: só o 1º atendimento concluído fica awaiting; resto unavailable
WITH keyed AS (
  SELECT
    b.id,
    b.review_status,
    ROW_NUMBER() OVER (
      PARTITION BY
        b.shop_id,
        CASE
          WHEN b.client_id IS NOT NULL THEN 'c:' || b.client_id::text
          WHEN b.shop_customer_id IS NOT NULL THEN 's:' || b.shop_customer_id::text
          WHEN length(regexp_replace(COALESCE(b.client_phone, ''), '[^0-9]', '', 'g')) >= 10
            THEN 'p:' || regexp_replace(COALESCE(b.client_phone, ''), '[^0-9]', '', 'g')
          ELSE 'b:' || b.id::text
        END
      ORDER BY b.completed_at NULLS LAST, b.created_at ASC
    ) AS rn
  FROM bookings b
  WHERE b.status = 'completed'
    AND b.review_status IN ('awaiting', 'reviewed')
)
UPDATE bookings b
SET review_status = 'unavailable'
FROM keyed k
WHERE b.id = k.id
  AND k.rn > 1
  AND b.review_status = 'awaiting';

-- Se já existe review do cliente na loja, fecha awaitings restantes
UPDATE bookings b
SET review_status = 'unavailable'
WHERE b.review_status = 'awaiting'
  AND EXISTS (
    SELECT 1
    FROM reviews r
    LEFT JOIN clients c ON c.id = r.client_id
    WHERE r.shop_id = b.shop_id
      AND (
        (b.client_id IS NOT NULL AND r.client_id = b.client_id)
        OR (
          length(regexp_replace(COALESCE(b.client_phone, ''), '[^0-9]', '', 'g')) >= 10
          AND regexp_replace(COALESCE(c.phone, ''), '[^0-9]', '', 'g')
            = regexp_replace(COALESCE(b.client_phone, ''), '[^0-9]', '', 'g')
        )
      )
  );

NOTIFY pgrst, 'reload schema';
