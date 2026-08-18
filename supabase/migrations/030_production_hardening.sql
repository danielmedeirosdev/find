-- Produção: endurece billing, agenda com overlap e view de slots.
-- 1) Dono não pode forjar subscription_status / trial / complimentary
-- 2) create_public_booking bloqueia conflito de duração
-- 3) expire_my_expired_trial para o painel bloquear trial sem escrever billing à mão
-- 4) public_booking_slots com security_invoker
-- 5) convert_shop_referral executável pelo service_role (webhook)

CREATE OR REPLACE FUNCTION public.protect_shop_billing_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'authenticated'
     AND current_setting('onefind.allow_billing_write', true) IS DISTINCT FROM 'on' THEN
    NEW.asaas_customer_id := OLD.asaas_customer_id;
    NEW.asaas_subscription_id := OLD.asaas_subscription_id;
    NEW.subscription_status := OLD.subscription_status;
    NEW.trial_ends_at := OLD.trial_ends_at;
    NEW.complimentary_until := OLD.complimentary_until;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS shops_protect_asaas_columns ON public.shops;
DROP TRIGGER IF EXISTS shops_protect_billing_columns ON public.shops;
CREATE TRIGGER shops_protect_billing_columns
  BEFORE UPDATE ON public.shops
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_shop_billing_columns();

CREATE OR REPLACE FUNCTION public.expire_my_expired_trial()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop public.shops%ROWTYPE;
  v_now TIMESTAMPTZ := now();
BEGIN
  SELECT * INTO v_shop
  FROM public.shops
  WHERE owner_user_id = auth.uid()
  FOR UPDATE;

  IF v_shop.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_shop');
  END IF;

  IF v_shop.subscription_status <> 'trial' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'reason', 'not_trial',
      'subscription_status', v_shop.subscription_status
    );
  END IF;

  IF v_shop.complimentary_until IS NOT NULL AND v_shop.complimentary_until > v_now THEN
    RETURN jsonb_build_object(
      'ok', true,
      'reason', 'complimentary_active',
      'subscription_status', v_shop.subscription_status
    );
  END IF;

  IF v_shop.trial_ends_at IS NULL OR v_shop.trial_ends_at > v_now THEN
    RETURN jsonb_build_object(
      'ok', true,
      'reason', 'trial_active',
      'subscription_status', v_shop.subscription_status
    );
  END IF;

  PERFORM set_config('onefind.allow_billing_write', 'on', true);

  UPDATE public.shops
  SET subscription_status = 'blocked'
  WHERE id = v_shop.id
    AND subscription_status = 'trial'
    AND (trial_ends_at IS NOT NULL AND trial_ends_at <= v_now)
    AND (complimentary_until IS NULL OR complimentary_until <= v_now);

  RETURN jsonb_build_object('ok', true, 'reason', 'blocked', 'subscription_status', 'blocked');
END;
$$;

REVOKE ALL ON FUNCTION public.expire_my_expired_trial() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_my_expired_trial() TO authenticated;

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
  v_duration INT := COALESCE(p_duration_minutes, 30);
  v_new_start INT;
  v_new_end INT;
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
  IF v_duration NOT BETWEEN 15 AND 720 THEN
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

  v_new_start := (EXTRACT(HOUR FROM p_time)::int * 60) + EXTRACT(MINUTE FROM p_time)::int;
  v_new_end := v_new_start + v_duration;

  IF EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.barber_id = p_barber_id
      AND b.date = p_date
      AND b.status NOT IN ('cancelled', 'no_show')
      AND (
        ((EXTRACT(HOUR FROM b.time)::int * 60) + EXTRACT(MINUTE FROM b.time)::int)
          < v_new_end
        AND v_new_start < (
          ((EXTRACT(HOUR FROM b.time)::int * 60) + EXTRACT(MINUTE FROM b.time)::int)
          + COALESCE(b.duration_minutes, 30)
        )
      )
  ) THEN
    RAISE EXCEPTION 'Esse horário acabou de ser reservado. Escolha outro horário.';
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
    v_duration,
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

CREATE OR REPLACE VIEW public.public_booking_slots
WITH (security_invoker = false)
AS
SELECT
  b.shop_id,
  b.barber_id,
  b.date,
  b.time,
  COALESCE(b.duration_minutes, 30) AS duration_minutes
FROM public.bookings b
WHERE b.status IN ('scheduled', 'confirmed', 'in_progress', 'awaiting_payment', 'completed')
  AND b.date >= CURRENT_DATE;

GRANT SELECT ON public.public_booking_slots TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.convert_shop_referral(UUID) TO service_role;

NOTIFY pgrst, 'reload schema';
