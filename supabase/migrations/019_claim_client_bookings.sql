-- Associa agendamentos feitos sem login (client_id null) à conta do cliente
-- quando o WhatsApp do perfil bate com o do booking.
-- Usado em Minhas Reservas (PET e barbearia).

CREATE OR REPLACE FUNCTION public.claim_my_bookings()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $claim_my_bookings$
DECLARE
  v_uid UUID := auth.uid();
  v_phone TEXT;
  v_digits TEXT;
  v_count INT := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Faça login para ver suas reservas';
  END IF;

  SELECT regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g')
  INTO v_digits
  FROM clients
  WHERE id = v_uid;

  IF v_digits IS NULL OR length(v_digits) < 10 THEN
    RETURN 0;
  END IF;

  -- Também aceita telefone só nos últimos dígitos (com/sem DDI 55)
  UPDATE bookings b
  SET client_id = v_uid
  WHERE b.client_id IS NULL
    AND (
      regexp_replace(COALESCE(b.client_phone, ''), '[^0-9]', '', 'g') = v_digits
      OR regexp_replace(COALESCE(b.client_phone, ''), '[^0-9]', '', 'g') = ('55' || v_digits)
      OR ('55' || regexp_replace(COALESCE(b.client_phone, ''), '[^0-9]', '', 'g')) = v_digits
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$claim_my_bookings$;

REVOKE ALL ON FUNCTION public.claim_my_bookings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_my_bookings() TO authenticated;
