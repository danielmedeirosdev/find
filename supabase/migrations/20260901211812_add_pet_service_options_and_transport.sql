-- Configuração avançada de serviços e preço fechado no servidor.
CREATE UNIQUE INDEX IF NOT EXISTS services_id_shop_uidx ON public.services (id, shop_id);
CREATE UNIQUE INDEX IF NOT EXISTS bookings_id_shop_uidx ON public.bookings (id, shop_id);

CREATE TABLE public.service_custom_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  service_id uuid NOT NULL,
  label text NOT NULL CHECK (char_length(btrim(label)) BETWEEN 2 AND 100),
  field_type text NOT NULL DEFAULT 'single_choice' CHECK (field_type IN ('single_choice', 'text')),
  required boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT service_custom_fields_service_fk FOREIGN KEY (service_id, shop_id)
    REFERENCES public.services(id, shop_id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX service_custom_fields_id_shop_uidx ON public.service_custom_fields (id, shop_id);
CREATE INDEX service_custom_fields_service_idx ON public.service_custom_fields (service_id, sort_order);

CREATE TABLE public.service_custom_field_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  field_id uuid NOT NULL,
  label text NOT NULL CHECK (char_length(btrim(label)) BETWEEN 1 AND 100),
  price_delta numeric(10,2) NOT NULL DEFAULT 0 CHECK (price_delta >= 0),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT service_custom_field_options_field_fk FOREIGN KEY (field_id, shop_id)
    REFERENCES public.service_custom_fields(id, shop_id) ON DELETE CASCADE
);
CREATE INDEX service_custom_field_options_field_idx ON public.service_custom_field_options (field_id, sort_order);

CREATE TABLE public.service_weekday_discounts (
  service_id uuid NOT NULL,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  discount_percent numeric(5,2) NOT NULL CHECK (discount_percent >= 0 AND discount_percent <= 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (service_id, day_of_week),
  CONSTRAINT service_weekday_discounts_service_fk FOREIGN KEY (service_id, shop_id)
    REFERENCES public.services(id, shop_id) ON DELETE CASCADE
);
CREATE INDEX service_weekday_discounts_shop_idx ON public.service_weekday_discounts (shop_id);

CREATE TABLE public.service_pet_transport (
  service_id uuid PRIMARY KEY,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  fee numeric(10,2) NOT NULL DEFAULT 0 CHECK (fee >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT service_pet_transport_service_fk FOREIGN KEY (service_id, shop_id)
    REFERENCES public.services(id, shop_id) ON DELETE CASCADE
);
CREATE INDEX service_pet_transport_shop_idx ON public.service_pet_transport (shop_id);

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS quoted_amount numeric(10,2),
  ADD COLUMN IF NOT EXISTS services_amount numeric(10,2),
  ADD COLUMN IF NOT EXISTS discount_amount numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extras_amount numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pet_transport_requested boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pet_transport_fee numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pet_transport_address text,
  ADD COLUMN IF NOT EXISTS pet_transport_notes text;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_quoted_amount_nonnegative CHECK (quoted_amount IS NULL OR quoted_amount >= 0),
  ADD CONSTRAINT bookings_services_amount_nonnegative CHECK (services_amount IS NULL OR services_amount >= 0),
  ADD CONSTRAINT bookings_discount_amount_nonnegative CHECK (discount_amount >= 0),
  ADD CONSTRAINT bookings_extras_amount_nonnegative CHECK (extras_amount >= 0),
  ADD CONSTRAINT bookings_transport_fee_nonnegative CHECK (pet_transport_fee >= 0);

CREATE TABLE public.booking_custom_field_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  field_id uuid REFERENCES public.service_custom_fields(id) ON DELETE SET NULL,
  field_label text NOT NULL,
  answer text NOT NULL,
  price_delta numeric(10,2) NOT NULL DEFAULT 0 CHECK (price_delta >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (booking_id, field_id),
  CONSTRAINT booking_custom_field_answers_booking_fk FOREIGN KEY (booking_id, shop_id)
    REFERENCES public.bookings(id, shop_id) ON DELETE CASCADE
);
CREATE INDEX booking_custom_field_answers_booking_idx ON public.booking_custom_field_answers (booking_id);
CREATE INDEX booking_custom_field_answers_shop_idx ON public.booking_custom_field_answers (shop_id);

ALTER TABLE public.service_custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_custom_field_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_weekday_discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_pet_transport ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_custom_field_answers ENABLE ROW LEVEL SECURITY;

-- Configurações necessárias no agendamento público.
CREATE POLICY "Public reads custom service fields" ON public.service_custom_fields FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.subscription_status <> 'blocked'));
CREATE POLICY "Public reads custom field options" ON public.service_custom_field_options FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.subscription_status <> 'blocked'));
CREATE POLICY "Public reads weekday discounts" ON public.service_weekday_discounts FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.subscription_status <> 'blocked'));
CREATE POLICY "Public reads pet transport settings" ON public.service_pet_transport FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.subscription_status <> 'blocked'));

-- Mutação somente pelo dono; políticas separadas evitam SELECT permissivo duplicado.
CREATE POLICY "Owners insert custom service fields" ON public.service_custom_fields FOR INSERT TO authenticated WITH CHECK (public.is_shop_owner(shop_id));
CREATE POLICY "Owners update custom service fields" ON public.service_custom_fields FOR UPDATE TO authenticated USING (public.is_shop_owner(shop_id)) WITH CHECK (public.is_shop_owner(shop_id));
CREATE POLICY "Owners delete custom service fields" ON public.service_custom_fields FOR DELETE TO authenticated USING (public.is_shop_owner(shop_id));
CREATE POLICY "Owners insert custom field options" ON public.service_custom_field_options FOR INSERT TO authenticated WITH CHECK (public.is_shop_owner(shop_id));
CREATE POLICY "Owners update custom field options" ON public.service_custom_field_options FOR UPDATE TO authenticated USING (public.is_shop_owner(shop_id)) WITH CHECK (public.is_shop_owner(shop_id));
CREATE POLICY "Owners delete custom field options" ON public.service_custom_field_options FOR DELETE TO authenticated USING (public.is_shop_owner(shop_id));
CREATE POLICY "Owners insert weekday discounts" ON public.service_weekday_discounts FOR INSERT TO authenticated WITH CHECK (public.is_shop_owner(shop_id));
CREATE POLICY "Owners update weekday discounts" ON public.service_weekday_discounts FOR UPDATE TO authenticated USING (public.is_shop_owner(shop_id)) WITH CHECK (public.is_shop_owner(shop_id));
CREATE POLICY "Owners delete weekday discounts" ON public.service_weekday_discounts FOR DELETE TO authenticated USING (public.is_shop_owner(shop_id));
CREATE POLICY "Owners insert pet transport settings" ON public.service_pet_transport FOR INSERT TO authenticated WITH CHECK (public.is_shop_owner(shop_id));
CREATE POLICY "Owners update pet transport settings" ON public.service_pet_transport FOR UPDATE TO authenticated USING (public.is_shop_owner(shop_id)) WITH CHECK (public.is_shop_owner(shop_id));
CREATE POLICY "Owners delete pet transport settings" ON public.service_pet_transport FOR DELETE TO authenticated USING (public.is_shop_owner(shop_id));
CREATE POLICY "Team reads booking custom answers" ON public.booking_custom_field_answers FOR SELECT TO authenticated
  USING (public.is_shop_owner(shop_id) OR public.is_shop_staff(shop_id));

REVOKE ALL ON public.service_custom_fields, public.service_custom_field_options, public.service_weekday_discounts, public.service_pet_transport, public.booking_custom_field_answers FROM PUBLIC;
GRANT SELECT ON public.service_custom_fields, public.service_custom_field_options, public.service_weekday_discounts, public.service_pet_transport TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_custom_fields, public.service_custom_field_options, public.service_weekday_discounts, public.service_pet_transport TO authenticated;
GRANT SELECT ON public.booking_custom_field_answers TO authenticated;

DROP FUNCTION IF EXISTS public.finalize_public_booking(uuid, text, uuid[], uuid[]);
CREATE FUNCTION public.finalize_public_booking(
  p_booking_id uuid,
  p_phone text,
  p_service_ids uuid[] DEFAULT '{}'::uuid[],
  p_pet_ids uuid[] DEFAULT '{}'::uuid[],
  p_custom_answers jsonb DEFAULT '[]'::jsonb,
  p_pet_transport boolean DEFAULT false,
  p_transport_address text DEFAULT NULL,
  p_transport_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_phone text := public.normalize_br_phone(p_phone);
  v_booking public.bookings%ROWTYPE;
  v_service_count integer;
  v_pet_count integer;
  v_pet_names text;
  v_answer jsonb;
  v_field public.service_custom_fields%ROWTYPE;
  v_option public.service_custom_field_options%ROWTYPE;
  v_field_id uuid;
  v_option_id uuid;
  v_answer_text text;
  v_undiscounted numeric(12,2) := 0;
  v_services_amount numeric(12,2) := 0;
  v_extras_amount numeric(12,2) := 0;
  v_transport_fee numeric(12,2) := 0;
  v_day integer;
BEGIN
  SELECT b.* INTO v_booking
  FROM public.bookings b
  WHERE b.id = p_booking_id
    AND public.normalize_br_phone(b.client_phone) = v_phone
    AND b.created_at > now() - interval '30 minutes'
  FOR UPDATE;

  IF v_booking.id IS NULL THEN RAISE EXCEPTION 'Agendamento inválido'; END IF;
  IF COALESCE(cardinality(p_service_ids), 0) = 0 THEN RAISE EXCEPTION 'Selecione ao menos um serviço'; END IF;
  IF cardinality(p_service_ids) > 20 OR COALESCE(cardinality(p_pet_ids), 0) > 2 THEN RAISE EXCEPTION 'Itens demais no agendamento'; END IF;
  IF jsonb_typeof(COALESCE(p_custom_answers, '[]'::jsonb)) <> 'array' OR jsonb_array_length(COALESCE(p_custom_answers, '[]'::jsonb)) > 30 THEN
    RAISE EXCEPTION 'Respostas personalizadas inválidas';
  END IF;

  SELECT count(DISTINCT s.id) INTO v_service_count
  FROM public.services s
  WHERE s.id = ANY(p_service_ids) AND s.shop_id = v_booking.shop_id AND s.is_active;
  IF v_service_count <> cardinality(p_service_ids) THEN RAISE EXCEPTION 'Serviço inválido'; END IF;

  IF COALESCE(cardinality(p_pet_ids), 0) > 0 THEN
    SELECT count(DISTINCT p.id), string_agg(DISTINCT p.name, ' · ')
      INTO v_pet_count, v_pet_names
    FROM public.pets p
    WHERE p.id = ANY(p_pet_ids) AND p.shop_id = v_booking.shop_id AND p.customer_id = v_booking.shop_customer_id;
    IF v_pet_count <> cardinality(p_pet_ids) THEN RAISE EXCEPTION 'Pet inválido'; END IF;
  END IF;

  INSERT INTO public.booking_services (booking_id, service_id)
  SELECT p_booking_id, sid FROM unnest(p_service_ids) sid
  ON CONFLICT (booking_id, service_id) DO NOTHING;
  INSERT INTO public.booking_pets (booking_id, pet_id)
  SELECT p_booking_id, pid FROM unnest(COALESCE(p_pet_ids, '{}'::uuid[])) pid
  ON CONFLICT (booking_id, pet_id) DO NOTHING;

  DELETE FROM public.booking_custom_field_answers WHERE booking_id = p_booking_id;
  FOR v_answer IN SELECT value FROM jsonb_array_elements(COALESCE(p_custom_answers, '[]'::jsonb)) LOOP
    BEGIN
      v_field_id := (v_answer->>'field_id')::uuid;
      v_option_id := NULLIF(v_answer->>'option_id', '')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'Resposta personalizada inválida';
    END;

    SELECT f.* INTO v_field FROM public.service_custom_fields f
    WHERE f.id = v_field_id AND f.shop_id = v_booking.shop_id AND f.service_id = ANY(p_service_ids);
    IF v_field.id IS NULL THEN RAISE EXCEPTION 'Campo personalizado inválido'; END IF;

    IF v_field.field_type = 'single_choice' THEN
      SELECT o.* INTO v_option FROM public.service_custom_field_options o
      WHERE o.id = v_option_id AND o.field_id = v_field.id AND o.shop_id = v_booking.shop_id;
      IF v_option.id IS NULL THEN RAISE EXCEPTION 'Opção personalizada inválida'; END IF;
      v_answer_text := v_option.label;
    ELSE
      v_answer_text := left(btrim(COALESCE(v_answer->>'value', '')), 500);
      IF v_field.required AND v_answer_text = '' THEN RAISE EXCEPTION 'Preencha todos os campos obrigatórios'; END IF;
      v_option.price_delta := 0;
    END IF;

    INSERT INTO public.booking_custom_field_answers (booking_id, shop_id, field_id, field_label, answer, price_delta)
    VALUES (p_booking_id, v_booking.shop_id, v_field.id, v_field.label, v_answer_text, COALESCE(v_option.price_delta, 0));
    v_field.id := NULL;
    v_option.id := NULL;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM public.service_custom_fields f
    WHERE f.service_id = ANY(p_service_ids) AND f.required
      AND NOT EXISTS (SELECT 1 FROM public.booking_custom_field_answers a WHERE a.booking_id = p_booking_id AND a.field_id = f.id)
  ) THEN RAISE EXCEPTION 'Preencha todos os campos obrigatórios'; END IF;

  SELECT COALESCE(sum(a.price_delta), 0) INTO v_extras_amount
  FROM public.booking_custom_field_answers a WHERE a.booking_id = p_booking_id;
  v_day := extract(dow FROM v_booking.date)::integer;

  IF COALESCE(cardinality(p_pet_ids), 0) > 0 THEN
    SELECT
      COALESCE(sum(COALESCE(r.price, s.price)), 0),
      COALESCE(sum(COALESCE(r.price, s.price) * (1 - COALESCE(d.discount_percent, 0) / 100)), 0)
      INTO v_undiscounted, v_services_amount
    FROM public.services s
    CROSS JOIN public.pets p
    LEFT JOIN public.service_size_rules r ON r.service_id = s.id AND r.size = p.size
    LEFT JOIN public.service_weekday_discounts d ON d.service_id = s.id AND d.day_of_week = v_day
    WHERE s.id = ANY(p_service_ids) AND p.id = ANY(p_pet_ids);
  ELSE
    SELECT
      COALESCE(sum(s.price), 0),
      COALESCE(sum(s.price * (1 - COALESCE(d.discount_percent, 0) / 100)), 0)
      INTO v_undiscounted, v_services_amount
    FROM public.services s
    LEFT JOIN public.service_weekday_discounts d ON d.service_id = s.id AND d.day_of_week = v_day
    WHERE s.id = ANY(p_service_ids);
  END IF;

  IF p_pet_transport THEN
    IF char_length(btrim(COALESCE(p_transport_address, ''))) < 5 THEN RAISE EXCEPTION 'Informe o endereço para buscar o pet'; END IF;
    SELECT max(t.fee) INTO v_transport_fee
    FROM public.service_pet_transport t
    WHERE t.service_id = ANY(p_service_ids) AND t.enabled;
    IF v_transport_fee IS NULL THEN RAISE EXCEPTION 'Táxi Pet indisponível para os serviços escolhidos'; END IF;
  END IF;

  UPDATE public.bookings SET
    services_amount = round(v_services_amount, 2),
    discount_amount = round(GREATEST(v_undiscounted - v_services_amount, 0), 2),
    extras_amount = round(v_extras_amount, 2),
    pet_transport_requested = p_pet_transport,
    pet_transport_fee = round(COALESCE(v_transport_fee, 0), 2),
    pet_transport_address = CASE WHEN p_pet_transport THEN left(btrim(p_transport_address), 500) ELSE NULL END,
    pet_transport_notes = CASE WHEN p_pet_transport THEN NULLIF(left(btrim(COALESCE(p_transport_notes, '')), 500), '') ELSE NULL END,
    quoted_amount = round(v_services_amount + v_extras_amount + COALESCE(v_transport_fee, 0), 2)
  WHERE id = p_booking_id;

  IF NOT EXISTS (SELECT 1 FROM public.notifications n WHERE n.booking_id = p_booking_id AND n.kind = 'new_booking') THEN
    INSERT INTO public.notifications (shop_id, audience, kind, title, body, booking_id)
    VALUES (
      v_booking.shop_id, 'owner', 'new_booking',
      CASE WHEN p_pet_transport THEN 'Novo agendamento com Táxi Pet' ELSE 'Novo agendamento' END,
      concat_ws(' · ', NULLIF(v_pet_names, ''), v_booking.client_name, to_char(v_booking.date, 'DD/MM/YYYY') || ' ' || to_char(v_booking.time, 'HH24:MI')),
      p_booking_id
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_public_booking(uuid, text, uuid[], uuid[], jsonb, boolean, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_public_booking(uuid, text, uuid[], uuid[], jsonb, boolean, text, text) TO anon, authenticated;
