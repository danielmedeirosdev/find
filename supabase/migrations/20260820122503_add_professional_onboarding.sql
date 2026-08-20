ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN;

-- Preserva o acesso dos estabelecimentos já configurados.
UPDATE public.shops
SET onboarding_completed = TRUE
WHERE onboarding_completed IS NULL;

-- Contas recentes que ainda estão vazias ou mantêm exatamente o seed antigo
-- entram no assistente, mas nenhum cadastro existente é apagado.
WITH recent_unconfigured AS (
  SELECT s.id
  FROM public.shops s
  LEFT JOIN public.services svc ON svc.shop_id = s.id
  WHERE s.created_at >= TIMESTAMPTZ '2026-08-20 00:00:00-03'
    AND NOT EXISTS (
      SELECT 1 FROM public.bookings b WHERE b.shop_id = s.id
    )
  GROUP BY s.id, s.segment
  HAVING COUNT(svc.id) = 0
    OR (
      s.segment = 'barbershop'
      AND COUNT(svc.id) = 3
      AND COUNT(DISTINCT svc.name) = 3
      AND BOOL_AND(
        (svc.name, svc.price, svc.duration_minutes) IN (
          ('Corte', 45::numeric, 40),
          ('Barba', 30::numeric, 25),
          ('Corte + Barba', 65::numeric, 55)
        )
      )
    )
    OR (
      s.segment = 'pet'
      AND COUNT(svc.id) IN (3, 4)
      AND COUNT(DISTINCT svc.name) = COUNT(svc.id)
      AND BOOL_AND(
        (svc.name, svc.price, svc.duration_minutes) IN (
          ('Banho', 50::numeric, 60),
          ('Tosa', 60::numeric, 90),
          ('Banho + Tosa', 100::numeric, 120),
          ('Hidratação', 40::numeric, 40)
        )
      )
    )
)
UPDATE public.shops s
SET onboarding_completed = FALSE
FROM recent_unconfigured u
WHERE s.id = u.id;

ALTER TABLE public.shops
  ALTER COLUMN onboarding_completed SET DEFAULT FALSE,
  ALTER COLUMN onboarding_completed SET NOT NULL;

CREATE OR REPLACE FUNCTION public.complete_professional_onboarding(
  p_shop_id UUID,
  p_services JSONB,
  p_staff JSONB,
  p_work_days INTEGER[],
  p_start_time TIME,
  p_end_time TIME
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_item JSONB;
  v_shop_segment TEXT;
  v_service_id UUID;
  v_barber_id UUID;
  v_day INTEGER;
  v_services_inserted INTEGER := 0;
  v_staff_inserted INTEGER := 0;
  v_name TEXT;
  v_role TEXT;
  v_price NUMERIC;
  v_duration INTEGER;
BEGIN
  SELECT segment
  INTO v_shop_segment
  FROM public.shops
  WHERE id = p_shop_id
    AND owner_user_id = (SELECT auth.uid());

  IF v_shop_segment IS NULL THEN
    RAISE EXCEPTION 'Estabelecimento não encontrado ou sem permissão.' USING ERRCODE = '42501';
  END IF;

  IF jsonb_typeof(COALESCE(p_services, '[]'::jsonb)) <> 'array'
    OR jsonb_typeof(COALESCE(p_staff, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'Serviços e equipe devem ser listas.' USING ERRCODE = '22023';
  END IF;

  IF jsonb_array_length(COALESCE(p_services, '[]'::jsonb)) > 30
    OR jsonb_array_length(COALESCE(p_staff, '[]'::jsonb)) > 20 THEN
    RAISE EXCEPTION 'Quantidade acima do limite permitido.' USING ERRCODE = '22023';
  END IF;

  IF p_start_time IS NULL OR p_end_time IS NULL OR p_end_time <= p_start_time THEN
    RAISE EXCEPTION 'O horário final deve ser posterior ao inicial.' USING ERRCODE = '22023';
  END IF;

  IF COALESCE(array_length(p_work_days, 1), 0) = 0
    OR EXISTS (SELECT 1 FROM unnest(p_work_days) AS d(day) WHERE day NOT BETWEEN 0 AND 6) THEN
    RAISE EXCEPTION 'Selecione ao menos um dia válido de atendimento.' USING ERRCODE = '22023';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(p_services, '[]'::jsonb))
  LOOP
    v_name := btrim(COALESCE(v_item->>'name', ''));
    v_price := NULLIF(v_item->>'price', '')::numeric;
    v_duration := NULLIF(v_item->>'duration_minutes', '')::integer;

    IF v_name = '' OR char_length(v_name) > 100
      OR v_price IS NULL OR v_price < 0
      OR v_duration IS NULL OR v_duration < 5 OR v_duration > 1440 THEN
      RAISE EXCEPTION 'Revise nome, preço e duração dos serviços.' USING ERRCODE = '22023';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.services svc
      WHERE svc.shop_id = p_shop_id
        AND lower(btrim(svc.name)) = lower(v_name)
    ) THEN
      INSERT INTO public.services (shop_id, name, price, duration_minutes)
      VALUES (p_shop_id, v_name, v_price, v_duration)
      RETURNING id INTO v_service_id;

      v_services_inserted := v_services_inserted + 1;

      IF v_shop_segment = 'pet' THEN
        INSERT INTO public.service_size_rules (service_id, size, duration_minutes, price)
        VALUES
          (v_service_id, 'pequeno', GREATEST(15, round(v_duration * 0.75)::integer), v_price),
          (v_service_id, 'medio', v_duration, v_price),
          (v_service_id, 'grande', round(v_duration * 1.5)::integer, round(v_price * 1.25, 2));
      END IF;
    END IF;
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM public.services WHERE shop_id = p_shop_id) THEN
    RAISE EXCEPTION 'Cadastre pelo menos um serviço.' USING ERRCODE = '22023';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(p_staff, '[]'::jsonb))
  LOOP
    v_name := btrim(COALESCE(v_item->>'name', ''));
    v_role := NULLIF(btrim(COALESCE(v_item->>'role', '')), '');

    IF v_name = '' OR char_length(v_name) > 100 OR char_length(COALESCE(v_role, '')) > 100 THEN
      RAISE EXCEPTION 'Revise os nomes e cargos da equipe.' USING ERRCODE = '22023';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.barbers b
      WHERE b.shop_id = p_shop_id
        AND lower(btrim(b.name)) = lower(v_name)
    ) THEN
      INSERT INTO public.barbers (shop_id, name, role)
      VALUES (p_shop_id, v_name, v_role)
      RETURNING id INTO v_barber_id;

      v_staff_inserted := v_staff_inserted + 1;

      FOREACH v_day IN ARRAY p_work_days
      LOOP
        INSERT INTO public.barber_schedule (
          barber_id, day_of_week, is_active, start_time, end_time
        )
        VALUES (v_barber_id, v_day, TRUE, p_start_time, p_end_time)
        ON CONFLICT (barber_id, day_of_week) DO NOTHING;
      END LOOP;
    END IF;
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM public.barbers WHERE shop_id = p_shop_id) THEN
    RAISE EXCEPTION 'Cadastre pelo menos uma pessoa que realiza atendimentos.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.shops
  SET onboarding_completed = TRUE
  WHERE id = p_shop_id
    AND owner_user_id = (SELECT auth.uid());

  RETURN jsonb_build_object(
    'ok', TRUE,
    'services_inserted', v_services_inserted,
    'staff_inserted', v_staff_inserted
  );
END;
$$;

REVOKE ALL ON FUNCTION public.complete_professional_onboarding(
  UUID, JSONB, JSONB, INTEGER[], TIME, TIME
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.complete_professional_onboarding(
  UUID, JSONB, JSONB, INTEGER[], TIME, TIME
) TO authenticated;

NOTIFY pgrst, 'reload schema';
