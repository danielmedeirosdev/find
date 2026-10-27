-- Reuse services and service_size_rules; no new table/column or seeded values.
-- One transaction prevents a partially saved duration. Existing prices are preserved.
CREATE OR REPLACE FUNCTION public.save_pet_service_duration(
  p_shop_id uuid,
  p_service_id uuid,
  p_name text,
  p_price numeric,
  p_duration_minutes integer,
  p_size_durations jsonb DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_id uuid;
  v_size text;
  v_minutes integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_shop_owner(p_shop_id)
    OR NOT EXISTS (SELECT 1 FROM public.shops WHERE id = p_shop_id AND segment = 'pet') THEN
    RAISE EXCEPTION 'Sem permissão para configurar este estabelecimento';
  END IF;
  IF p_duration_minutes IS NULL OR p_duration_minutes NOT BETWEEN 1 AND 720 THEN
    RAISE EXCEPTION 'Informe uma duração entre 1 e 720 minutos';
  END IF;
  IF p_size_durations IS NOT NULL THEN
    IF jsonb_typeof(p_size_durations) <> 'object' THEN RAISE EXCEPTION 'Informe os tempos por porte'; END IF;
    IF (SELECT count(*) FROM jsonb_object_keys(p_size_durations)) <> 3 THEN
      RAISE EXCEPTION 'Informe o tempo de cada porte';
    END IF;
    -- Matches the existing pets.size and service_size_rules.size constraints.
    FOREACH v_size IN ARRAY ARRAY['pequeno', 'medio', 'grande'] LOOP
      IF NOT COALESCE((p_size_durations->>v_size) ~ '^[0-9]+$', false) THEN
        RAISE EXCEPTION 'Informe o tempo de cada porte';
      END IF;
      v_minutes := (p_size_durations->>v_size)::integer;
      IF v_minutes NOT BETWEEN 1 AND 720 THEN RAISE EXCEPTION 'Duração inválida'; END IF;
    END LOOP;
  END IF;
  IF p_service_id IS NULL THEN
    IF p_name IS NULL OR length(btrim(p_name)) = 0 OR p_price IS NULL OR p_price < 0 OR p_price::text = 'NaN' THEN
      RAISE EXCEPTION 'Informe o nome e o preço do serviço';
    END IF;
    INSERT INTO public.services(shop_id, name, price, duration_minutes)
      VALUES(p_shop_id, btrim(p_name), p_price, p_duration_minutes) RETURNING id INTO v_id;
  ELSE
    UPDATE public.services SET duration_minutes = p_duration_minutes
      WHERE id = p_service_id AND shop_id = p_shop_id RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'Serviço inválido'; END IF;
  END IF;
  IF p_size_durations IS NULL THEN
    UPDATE public.service_size_rules SET duration_minutes = p_duration_minutes WHERE service_id = v_id;
  ELSE
    FOREACH v_size IN ARRAY ARRAY['pequeno', 'medio', 'grande'] LOOP
      INSERT INTO public.service_size_rules(service_id, size, duration_minutes)
        VALUES(v_id, v_size, (p_size_durations->>v_size)::integer)
      ON CONFLICT(service_id, size) DO UPDATE SET duration_minutes = EXCLUDED.duration_minutes;
    END LOOP;
  END IF;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.save_pet_service_duration(uuid,uuid,text,numeric,integer,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_pet_service_duration(uuid,uuid,text,numeric,integer,jsonb) TO authenticated;

-- Short services may also be booked alone through the public flow.
CREATE OR REPLACE FUNCTION public.create_public_booking(p_shop_id uuid, p_barber_id uuid, p_client_name text, p_client_phone text, p_date date, p_time time without time zone, p_pet_id uuid DEFAULT NULL::uuid, p_shop_customer_id uuid DEFAULT NULL::uuid, p_duration_minutes integer DEFAULT NULL::integer, p_notes text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  IF p_date < (now() at time zone 'America/Sao_Paulo')::date OR p_date > (now() at time zone 'America/Sao_Paulo')::date + 365 THEN
    RAISE EXCEPTION 'Data inválida';
  END IF;
  IF v_duration NOT BETWEEN 1 AND 720 THEN
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
    shop_id, barber_id, client_id, client_name, client_phone, date, time,
    pet_id, shop_customer_id, duration_minutes, notes, status
  ) VALUES (
    p_shop_id, p_barber_id, auth.uid(), v_name, v_phone, p_date, p_time,
    p_pet_id, p_shop_customer_id, v_duration, v_notes, 'scheduled'
  )
  RETURNING id INTO v_booking_id;

  RETURN v_booking_id;
END;
$function$;
