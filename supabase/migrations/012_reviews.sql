-- ============================================================
-- Reviews: avaliação pós-serviço
-- ============================================================

-- Status interno do atendimento quanto à avaliação
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS review_status TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bookings_review_status_check'
  ) THEN
    ALTER TABLE bookings
      ADD CONSTRAINT bookings_review_status_check
      CHECK (
        review_status IS NULL
        OR review_status IN ('awaiting', 'reviewed', 'unavailable')
      );
  END IF;
END $$;

COMMENT ON COLUMN bookings.review_status IS
  'awaiting = aguardando avaliação do cliente; reviewed = avaliado; unavailable = sem cliente logado ou não elegível';

CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  barber_id UUID NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT reviews_one_per_booking UNIQUE (booking_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_shop ON reviews(shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_barber ON reviews(barber_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_client ON reviews(client_id);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Público: lê avaliações de barbearias ativas
DROP POLICY IF EXISTS "Public read reviews of active shops" ON reviews;
CREATE POLICY "Public read reviews of active shops"
  ON reviews FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM shops
      WHERE shops.id = reviews.shop_id
        AND shops.subscription_status != 'blocked'
    )
  );

-- Dono lê todas as avaliações da própria loja (mesmo bloqueada)
DROP POLICY IF EXISTS "Owners read own shop reviews" ON reviews;
CREATE POLICY "Owners read own shop reviews"
  ON reviews FOR SELECT
  USING (is_shop_owner(shop_id));

-- Cliente lê as próprias avaliações
DROP POLICY IF EXISTS "Clients read own reviews" ON reviews;
CREATE POLICY "Clients read own reviews"
  ON reviews FOR SELECT
  USING (client_id = auth.uid());

-- Sem INSERT/UPDATE/DELETE direto: apenas via RPC submit_review

-- ============================================================
-- Agregados (views públicas)
-- ============================================================

CREATE OR REPLACE VIEW public.barber_rating_stats
WITH (security_invoker = true)
AS
SELECT
  r.barber_id,
  r.shop_id,
  ROUND(AVG(r.rating)::numeric, 1) AS avg_rating,
  COUNT(*)::integer AS review_count,
  COUNT(*) FILTER (WHERE r.rating = 5)::integer AS star_5,
  COUNT(*) FILTER (WHERE r.rating = 4)::integer AS star_4,
  COUNT(*) FILTER (WHERE r.rating = 3)::integer AS star_3,
  COUNT(*) FILTER (WHERE r.rating = 2)::integer AS star_2,
  COUNT(*) FILTER (WHERE r.rating = 1)::integer AS star_1
FROM reviews r
GROUP BY r.barber_id, r.shop_id;

CREATE OR REPLACE VIEW public.shop_rating_stats
WITH (security_invoker = true)
AS
SELECT
  r.shop_id,
  ROUND(AVG(r.rating)::numeric, 1) AS avg_rating,
  COUNT(*)::integer AS review_count,
  COUNT(*) FILTER (WHERE r.rating = 5)::integer AS star_5,
  COUNT(*) FILTER (WHERE r.rating = 4)::integer AS star_4,
  COUNT(*) FILTER (WHERE r.rating = 3)::integer AS star_3,
  COUNT(*) FILTER (WHERE r.rating = 2)::integer AS star_2,
  COUNT(*) FILTER (WHERE r.rating = 1)::integer AS star_1
FROM reviews r
GROUP BY r.shop_id;

GRANT SELECT ON public.barber_rating_stats TO anon, authenticated;
GRANT SELECT ON public.shop_rating_stats TO anon, authenticated;

-- ============================================================
-- complete_booking: libera avaliação quando há cliente logado
-- ============================================================

CREATE OR REPLACE FUNCTION public.complete_booking(
  p_booking_id UUID,
  p_service_ids UUID[],
  p_payment_method TEXT,
  p_amount NUMERIC
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
BEGIN
  IF p_payment_method IS NULL OR p_payment_method NOT IN ('pix', 'cartao', 'dinheiro') THEN
    RAISE EXCEPTION 'Forma de pagamento inválida';
  END IF;

  IF p_service_ids IS NULL OR array_length(p_service_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Selecione ao menos um serviço';
  END IF;

  SELECT shop_id, client_name, client_id
  INTO v_shop_id, v_client_name, v_client_id
  FROM bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF v_shop_id IS NULL THEN
    RAISE EXCEPTION 'Agendamento não encontrado';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM shops WHERE id = v_shop_id AND owner_user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Sem permissão para finalizar este atendimento';
  END IF;

  UPDATE bookings
  SET
    status = 'completed',
    payment_method = p_payment_method,
    completed_at = now(),
    review_status = CASE
      WHEN v_client_id IS NOT NULL THEN 'awaiting'
      ELSE 'unavailable'
    END
  WHERE id = p_booking_id;

  DELETE FROM booking_services WHERE booking_id = p_booking_id;

  INSERT INTO booking_services (booking_id, service_id)
  SELECT DISTINCT p_booking_id, sid
  FROM unnest(p_service_ids) AS sid;

  INSERT INTO financial_transactions (
    shop_id,
    booking_id,
    type,
    description,
    amount,
    payment_method
  ) VALUES (
    v_shop_id,
    p_booking_id,
    'entrada',
    'Atendimento - ' || v_client_name,
    p_amount,
    p_payment_method
  );
END;
$$;

-- ============================================================
-- submit_review: única forma de criar avaliação
-- ============================================================

CREATE OR REPLACE FUNCTION public.submit_review(
  p_booking_id UUID,
  p_rating SMALLINT,
  p_comment TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  IF EXISTS (SELECT 1 FROM reviews WHERE booking_id = p_booking_id) THEN
    RAISE EXCEPTION 'Este atendimento já foi avaliado';
  END IF;

  IF v_booking.review_status = 'reviewed' THEN
    RAISE EXCEPTION 'Este atendimento já foi avaliado';
  END IF;

  INSERT INTO reviews (
    booking_id,
    shop_id,
    barber_id,
    client_id,
    rating,
    comment
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

  RETURN v_review_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_review(UUID, SMALLINT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_review(UUID, SMALLINT, TEXT) TO authenticated;

-- Backfill: atendimentos concluídos com cliente ainda sem review
UPDATE bookings b
SET review_status = 'awaiting'
WHERE b.status = 'completed'
  AND b.client_id IS NOT NULL
  AND b.review_status IS NULL
  AND NOT EXISTS (SELECT 1 FROM reviews r WHERE r.booking_id = b.id);

UPDATE bookings b
SET review_status = 'unavailable'
WHERE b.status = 'completed'
  AND b.client_id IS NULL
  AND b.review_status IS NULL;

NOTIFY pgrst, 'reload schema';
