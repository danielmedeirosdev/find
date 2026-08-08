-- Fix: submit_review falhava quando o usuário autenticado não tinha linha em clients
-- (ex.: conta criada sem trigger/perfil, ou booking com client_id sem clients row).

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

  IF EXISTS (SELECT 1 FROM reviews WHERE booking_id = p_booking_id) THEN
    RAISE EXCEPTION 'Este atendimento já foi avaliado';
  END IF;

  IF v_booking.review_status = 'reviewed' THEN
    RAISE EXCEPTION 'Este atendimento já foi avaliado';
  END IF;

  -- Garante perfil em clients (FK de reviews.client_id)
  INSERT INTO clients (id, name, phone)
  VALUES (
    v_user_id,
    COALESCE(NULLIF(TRIM(v_booking.client_name), ''), 'Cliente'),
    NULLIF(TRIM(v_booking.client_phone), '')
  )
  ON CONFLICT (id) DO NOTHING;

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

NOTIFY pgrst, 'reload schema';
