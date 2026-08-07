-- Helper + RPCs para agenda (finalizar / cancelar / não compareceu)

CREATE OR REPLACE FUNCTION public.is_shop_owner(p_shop_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM shops
    WHERE id = p_shop_id AND owner_user_id = auth.uid()
  );
$$;

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
BEGIN
  IF p_payment_method IS NULL OR p_payment_method NOT IN ('pix', 'cartao', 'dinheiro') THEN
    RAISE EXCEPTION 'Forma de pagamento inválida';
  END IF;

  IF p_service_ids IS NULL OR array_length(p_service_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Selecione ao menos um serviço';
  END IF;

  SELECT shop_id, client_name
  INTO v_shop_id, v_client_name
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
    completed_at = now()
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
BEGIN
  IF p_status NOT IN ('no_show', 'cancelled') THEN
    RAISE EXCEPTION 'Status inválido';
  END IF;

  SELECT shop_id INTO v_shop_id
  FROM bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF v_shop_id IS NULL THEN
    RAISE EXCEPTION 'Agendamento não encontrado';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM shops WHERE id = v_shop_id AND owner_user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Sem permissão para atualizar este agendamento';
  END IF;

  UPDATE bookings
  SET status = p_status
  WHERE id = p_booking_id;
END;
$$;

-- Limpa serviços duplicados (se ainda houver)
DELETE FROM booking_services a
USING booking_services b
WHERE a.ctid < b.ctid
  AND a.booking_id = b.booking_id
  AND a.service_id = b.service_id;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'booking_services_pkey'
  ) THEN
    ALTER TABLE booking_services
      ADD CONSTRAINT booking_services_pkey PRIMARY KEY (booking_id, service_id);
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.complete_booking(UUID, UUID[], TEXT, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_booking(UUID, UUID[], TEXT, NUMERIC) TO authenticated;

REVOKE ALL ON FUNCTION public.update_booking_status(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_booking_status(UUID, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.is_shop_owner(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_shop_owner(UUID) TO authenticated, anon;

NOTIFY pgrst, 'reload schema';
