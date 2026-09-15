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
  IF p_duration_minutes IS NULL OR p_duration_minutes NOT BETWEEN 15 AND 720 THEN
    RAISE EXCEPTION 'Informe uma duração entre 15 e 720 minutos';
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
      IF v_minutes NOT BETWEEN 15 AND 720 THEN RAISE EXCEPTION 'Duração inválida'; END IF;
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
