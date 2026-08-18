-- Programa de indicação ONEFIND
-- Regras de recompensa ficam em referral_programs (alteráveis sem reescrever o sistema).
-- Modelo inicial: 1 conversão = 1 mês; 3 conversões = 3 meses (1 mês por conversão).
-- Conversão só ocorre após pagamento confirmado (Asaas). Frontend não concede recompensa.

ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS complimentary_until TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.referral_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  months_per_conversion INTEGER NOT NULL DEFAULT 1
    CHECK (months_per_conversion >= 0),
  milestone_conversions INTEGER NOT NULL DEFAULT 3
    CHECK (milestone_conversions >= 1),
  milestone_bonus_months INTEGER NOT NULL DEFAULT 0
    CHECK (milestone_bonus_months >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.referral_programs (
  slug, name, is_active, months_per_conversion, milestone_conversions, milestone_bonus_months
) VALUES (
  'default',
  'Indique e ganhe',
  true,
  1,
  3,
  0
)
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.referral_codes (
  shop_id UUID PRIMARY KEY REFERENCES public.shops(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT referral_codes_format CHECK (code ~ '^ONEFIND-[A-Z2-9]{5}$')
);

CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.referral_programs(id),
  referrer_shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  referred_shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  referral_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'trial'
    CHECK (status IN ('trial', 'converted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  converted_at TIMESTAMPTZ,
  CONSTRAINT referrals_no_self CHECK (referrer_shop_id <> referred_shop_id),
  CONSTRAINT referrals_referred_unique UNIQUE (referred_shop_id)
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals (referrer_shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON public.referrals (status);

CREATE TABLE IF NOT EXISTS public.referral_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.referral_programs(id),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  referral_id UUID REFERENCES public.referrals(id) ON DELETE SET NULL,
  reward_kind TEXT NOT NULL CHECK (reward_kind IN ('conversion', 'milestone')),
  months INTEGER NOT NULL CHECK (months > 0),
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'redeemed')),
  conversion_count_at_grant INTEGER,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  redeemed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_rewards_conversion_once
  ON public.referral_rewards (referral_id)
  WHERE reward_kind = 'conversion' AND referral_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_rewards_milestone_once
  ON public.referral_rewards (shop_id, program_id, reward_kind, conversion_count_at_grant)
  WHERE reward_kind = 'milestone';

CREATE TABLE IF NOT EXISTS public.referral_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL,
  referral_id UUID REFERENCES public.referrals(id) ON DELETE SET NULL,
  shop_id UUID REFERENCES public.shops(id) ON DELETE SET NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referral_events_created ON public.referral_events (created_at DESC);

ALTER TABLE public.referral_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners read own referral program" ON public.referral_programs;
CREATE POLICY "Owners read own referral program" ON public.referral_programs
  FOR SELECT TO authenticated
  USING (is_active);

DROP POLICY IF EXISTS "Owners read own referral code" ON public.referral_codes;
CREATE POLICY "Owners read own referral code" ON public.referral_codes
  FOR SELECT TO authenticated
  USING (public.is_shop_owner(shop_id));

DROP POLICY IF EXISTS "Owners read own referrals" ON public.referrals;
CREATE POLICY "Owners read own referrals" ON public.referrals
  FOR SELECT TO authenticated
  USING (public.is_shop_owner(referrer_shop_id));

DROP POLICY IF EXISTS "Owners read own referral rewards" ON public.referral_rewards;
CREATE POLICY "Owners read own referral rewards" ON public.referral_rewards
  FOR SELECT TO authenticated
  USING (public.is_shop_owner(shop_id));

-- referral_events: sem policy para authenticated → somente service_role/backend

CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  alphabet TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate TEXT;
  i INT;
  ch TEXT;
BEGIN
  LOOP
    candidate := 'ONEFIND-';
    FOR i IN 1..5 LOOP
      ch := substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
      candidate := candidate || ch;
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.referral_codes WHERE code = candidate);
  END LOOP;
  RETURN candidate;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_referral_code(p_shop_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code TEXT;
BEGIN
  SELECT code INTO v_code FROM public.referral_codes WHERE shop_id = p_shop_id;
  IF v_code IS NOT NULL THEN
    RETURN v_code;
  END IF;

  v_code := public.generate_referral_code();
  INSERT INTO public.referral_codes (shop_id, code)
  VALUES (p_shop_id, v_code)
  ON CONFLICT (shop_id) DO UPDATE SET code = public.referral_codes.code
  RETURNING code INTO v_code;

  RETURN v_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_shops_ensure_referral_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.ensure_referral_code(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS shops_ensure_referral_code ON public.shops;
CREATE TRIGGER shops_ensure_referral_code
  AFTER INSERT ON public.shops
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_shops_ensure_referral_code();

CREATE OR REPLACE FUNCTION public.normalize_referral_code(p_code TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_code IS NULL THEN NULL
    WHEN btrim(upper(p_code)) ~ '^ONEFIND-[A-Z2-9]{5}$' THEN btrim(upper(p_code))
    WHEN btrim(upper(p_code)) ~ '^[A-Z2-9]{5}$' THEN 'ONEFIND-' || btrim(upper(p_code))
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.record_referral_event(
  p_kind TEXT,
  p_referral_id UUID,
  p_shop_id UUID,
  p_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.referral_events (kind, referral_id, shop_id, payload)
  VALUES (p_kind, p_referral_id, p_shop_id, COALESCE(p_payload, '{}'::jsonb));
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_referral_owner(
  p_shop_id UUID,
  p_kind TEXT,
  p_title TEXT,
  p_body TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (shop_id, audience, kind, title, body)
  VALUES (p_shop_id, 'owner', p_kind, p_title, p_body);
END;
$$;

CREATE OR REPLACE FUNCTION public.attach_shop_referral(p_shop_id UUID, p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code TEXT;
  v_referrer UUID;
  v_program UUID;
  v_existing UUID;
  v_id UUID;
  v_name TEXT;
BEGIN
  v_code := public.normalize_referral_code(p_code);
  IF v_code IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_code');
  END IF;

  SELECT rc.shop_id INTO v_referrer
  FROM public.referral_codes rc
  WHERE rc.code = v_code;

  IF v_referrer IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unknown_code');
  END IF;

  IF v_referrer = p_shop_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'self_referral');
  END IF;

  SELECT id INTO v_existing FROM public.referrals WHERE referred_shop_id = p_shop_id;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'already_attached', 'referral_id', v_existing);
  END IF;

  SELECT id INTO v_program
  FROM public.referral_programs
  WHERE is_active
  ORDER BY created_at
  LIMIT 1;

  IF v_program IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_program');
  END IF;

  INSERT INTO public.referrals (
    program_id, referrer_shop_id, referred_shop_id, referral_code, status
  )
  VALUES (v_program, v_referrer, p_shop_id, v_code, 'trial')
  ON CONFLICT (referred_shop_id) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM public.referrals WHERE referred_shop_id = p_shop_id;
    RETURN jsonb_build_object('ok', true, 'reason', 'already_attached', 'referral_id', v_id);
  END IF;

  SELECT name INTO v_name FROM public.shops WHERE id = p_shop_id;

  PERFORM public.record_referral_event(
    'referral_signup',
    v_id,
    v_referrer,
    jsonb_build_object('referred_shop_id', p_shop_id, 'code', v_code)
  );

  PERFORM public.notify_referral_owner(
    v_referrer,
    'referral_trial',
    'Sua indicação entrou no teste!',
    COALESCE(v_name, 'Uma empresa') || ' criou a conta pelo seu link e está no período de teste.'
  );

  RETURN jsonb_build_object('ok', true, 'reason', 'attached', 'referral_id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.attach_my_referral(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop UUID;
BEGIN
  SELECT id INTO v_shop
  FROM public.shops
  WHERE owner_user_id = auth.uid();

  IF v_shop IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_shop');
  END IF;

  RETURN public.attach_shop_referral(v_shop, p_code);
END;
$$;

CREATE OR REPLACE FUNCTION public.convert_shop_referral(p_shop_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref public.referrals%ROWTYPE;
  v_program public.referral_programs%ROWTYPE;
  v_converted_count INTEGER;
  v_reward_id UUID;
  v_name TEXT;
  v_updated INTEGER;
BEGIN
  UPDATE public.referrals
  SET status = 'converted', converted_at = COALESCE(converted_at, now())
  WHERE referred_shop_id = p_shop_id
    AND status = 'trial'
  RETURNING * INTO v_ref;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    SELECT * INTO v_ref FROM public.referrals WHERE referred_shop_id = p_shop_id;
    IF v_ref.id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'no_referral');
    END IF;
    RETURN jsonb_build_object('ok', true, 'reason', 'already_converted', 'referral_id', v_ref.id);
  END IF;

  SELECT * INTO v_program FROM public.referral_programs WHERE id = v_ref.program_id;

  INSERT INTO public.referral_rewards (
    program_id, shop_id, referral_id, reward_kind, months, status, conversion_count_at_grant
  )
  VALUES (
    v_ref.program_id,
    v_ref.referrer_shop_id,
    v_ref.id,
    'conversion',
    GREATEST(v_program.months_per_conversion, 1),
    'available',
    NULL
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_reward_id;

  SELECT count(*)::int INTO v_converted_count
  FROM public.referrals
  WHERE referrer_shop_id = v_ref.referrer_shop_id
    AND program_id = v_ref.program_id
    AND status = 'converted';

  IF v_program.milestone_bonus_months > 0
     AND v_converted_count = v_program.milestone_conversions THEN
    INSERT INTO public.referral_rewards (
      program_id, shop_id, referral_id, reward_kind, months, status, conversion_count_at_grant
    )
    VALUES (
      v_ref.program_id,
      v_ref.referrer_shop_id,
      NULL,
      'milestone',
      v_program.milestone_bonus_months,
      'available',
      v_converted_count
    )
    ON CONFLICT DO NOTHING;
  END IF;

  SELECT name INTO v_name FROM public.shops WHERE id = p_shop_id;

  PERFORM public.record_referral_event(
    'referral_converted',
    v_ref.id,
    v_ref.referrer_shop_id,
    jsonb_build_object('referred_shop_id', p_shop_id, 'converted_count', v_converted_count)
  );

  PERFORM public.notify_referral_owner(
    v_ref.referrer_shop_id,
    'referral_converted',
    'Boa! A indicação da sua empresa foi convertida. Você ganhou 1 mês grátis.',
    COALESCE(v_name, 'A empresa indicada') ||
      ' assinou o ONEFIND. A recompensa já está disponível para aplicar.'
  );

  IF v_converted_count = v_program.milestone_conversions THEN
    PERFORM public.notify_referral_owner(
      v_ref.referrer_shop_id,
      'referral_milestone',
      'Você desbloqueou 3 meses grátis!',
      'Você chegou a ' || v_converted_count ||
        ' indicações convertidas. Continue indicando para acumular mais benefícios.'
    );
    PERFORM public.record_referral_event(
      'referral_reward_granted',
      v_ref.id,
      v_ref.referrer_shop_id,
      jsonb_build_object('milestone', v_program.milestone_conversions, 'converted_count', v_converted_count)
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'reason', 'converted',
    'referral_id', v_ref.id,
    'converted_count', v_converted_count
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.redeem_referral_reward(p_reward_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reward public.referral_rewards%ROWTYPE;
  v_shop public.shops%ROWTYPE;
  v_base TIMESTAMPTZ;
  v_until TIMESTAMPTZ;
  v_updated INTEGER;
BEGIN
  SELECT * INTO v_reward
  FROM public.referral_rewards
  WHERE id = p_reward_id
  FOR UPDATE;

  IF v_reward.id IS NULL THEN
    RAISE EXCEPTION 'Recompensa não encontrada';
  END IF;

  IF NOT public.is_shop_owner(v_reward.shop_id) THEN
    RAISE EXCEPTION 'Sem permissão para aplicar esta recompensa';
  END IF;

  IF v_reward.status = 'redeemed' THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'already_redeemed');
  END IF;

  SELECT * INTO v_shop FROM public.shops WHERE id = v_reward.shop_id FOR UPDATE;

  v_base := now();
  IF v_shop.complimentary_until IS NOT NULL AND v_shop.complimentary_until > v_base THEN
    v_base := v_shop.complimentary_until;
  END IF;
  IF v_shop.subscription_status = 'trial'
     AND v_shop.trial_ends_at IS NOT NULL
     AND v_shop.trial_ends_at > v_base THEN
    v_base := v_shop.trial_ends_at;
  END IF;

  v_until := v_base + make_interval(months => v_reward.months);

  UPDATE public.referral_rewards
  SET status = 'redeemed', redeemed_at = now()
  WHERE id = v_reward.id
    AND status = 'available';
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'already_redeemed');
  END IF;

  UPDATE public.shops
  SET
    complimentary_until = v_until,
    trial_ends_at = CASE
      WHEN subscription_status IN ('trial', 'blocked') THEN v_until
      ELSE trial_ends_at
    END,
    subscription_status = CASE
      WHEN subscription_status = 'blocked' THEN 'trial'
      ELSE subscription_status
    END
  WHERE id = v_shop.id;

  PERFORM public.record_referral_event(
    'referral_reward_redeemed',
    v_reward.referral_id,
    v_reward.shop_id,
    jsonb_build_object('reward_id', v_reward.id, 'months', v_reward.months, 'until', v_until)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'reason', 'redeemed',
    'months', v_reward.months,
    'complimentary_until', v_until
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_referral_overview()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop UUID;
  v_segment TEXT;
  v_code TEXT;
  v_program public.referral_programs%ROWTYPE;
  v_sent INTEGER;
  v_trial INTEGER;
  v_converted INTEGER;
  v_months_available INTEGER;
  v_months_redeemed INTEGER;
  v_rows JSONB;
  v_rewards JSONB;
  v_remaining INTEGER;
BEGIN
  SELECT id, segment INTO v_shop, v_segment
  FROM public.shops
  WHERE owner_user_id = auth.uid();

  IF v_shop IS NULL THEN
    RAISE EXCEPTION 'Estabelecimento não encontrado';
  END IF;

  v_code := public.ensure_referral_code(v_shop);

  SELECT * INTO v_program
  FROM public.referral_programs
  WHERE is_active
  ORDER BY created_at
  LIMIT 1;

  SELECT
    count(*)::int,
    count(*) FILTER (WHERE r.status = 'trial')::int,
    count(*) FILTER (WHERE r.status = 'converted')::int
  INTO v_sent, v_trial, v_converted
  FROM public.referrals r
  WHERE r.referrer_shop_id = v_shop;

  SELECT
    COALESCE(sum(months) FILTER (WHERE status = 'available'), 0)::int,
    COALESCE(sum(months) FILTER (WHERE status = 'redeemed'), 0)::int
  INTO v_months_available, v_months_redeemed
  FROM public.referral_rewards
  WHERE shop_id = v_shop;

  SELECT COALESCE(jsonb_agg(item ORDER BY created_at DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT jsonb_build_object(
      'id', r.id,
      'company', s.name,
      'segment', s.segment,
      'created_at', r.created_at,
      'status', r.status,
      'reward_status', COALESCE(rw.status, CASE WHEN r.status = 'converted' THEN 'available' ELSE NULL END)
    ) AS item,
    r.created_at
    FROM public.referrals r
    JOIN public.shops s ON s.id = r.referred_shop_id
    LEFT JOIN public.referral_rewards rw
      ON rw.referral_id = r.id AND rw.reward_kind = 'conversion'
    WHERE r.referrer_shop_id = v_shop
  ) q;

  SELECT COALESCE(jsonb_agg(item ORDER BY granted_at DESC), '[]'::jsonb)
  INTO v_rewards
  FROM (
    SELECT jsonb_build_object(
      'id', rw.id,
      'kind', rw.reward_kind,
      'months', rw.months,
      'status', rw.status,
      'granted_at', rw.granted_at,
      'redeemed_at', rw.redeemed_at
    ) AS item,
    rw.granted_at
    FROM public.referral_rewards rw
    WHERE rw.shop_id = v_shop
  ) q;

  v_remaining := GREATEST(v_program.milestone_conversions - v_converted, 0);

  RETURN jsonb_build_object(
    'code', v_code,
    'segment', v_segment,
    'program', jsonb_build_object(
      'slug', v_program.slug,
      'name', v_program.name,
      'months_per_conversion', v_program.months_per_conversion,
      'milestone_conversions', v_program.milestone_conversions,
      'milestone_bonus_months', v_program.milestone_bonus_months
    ),
    'stats', jsonb_build_object(
      'sent', v_sent,
      'trial', v_trial,
      'converted', v_converted,
      'months_available', v_months_available,
      'months_redeemed', v_months_redeemed
    ),
    'progress', jsonb_build_object(
      'current', LEAST(v_converted, v_program.milestone_conversions),
      'target', v_program.milestone_conversions,
      'remaining', v_remaining
    ),
    'referrals', COALESCE(v_rows, '[]'::jsonb),
    'rewards', COALESCE(v_rewards, '[]'::jsonb)
  );
END;
$$;

-- handle_new_user: preserva comportamento atual e associa referral do metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT;
  v_base TEXT;
  v_slug TEXT;
  v_segment TEXT;
  v_shop_id UUID;
  n INT := 1;
BEGIN
  IF NEW.raw_user_meta_data->>'role' = 'barber' THEN
    v_segment := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'segment'), ''), 'barbershop');
    IF v_segment NOT IN ('barbershop', 'pet') THEN
      v_segment := 'barbershop';
    END IF;

    v_name := COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'shop_name'), ''),
      CASE WHEN v_segment = 'pet' THEN 'Meu Pet Shop' ELSE 'Minha Barbearia' END
    );
    v_base := public.slugify(v_name);
    IF v_base IS NULL OR v_base = '' THEN
      v_base := CASE WHEN v_segment = 'pet' THEN 'pet-shop' ELSE 'barbearia' END;
    END IF;
    v_slug := v_base;
    WHILE EXISTS (SELECT 1 FROM shops WHERE slug = v_slug) LOOP
      n := n + 1;
      v_slug := v_base || '-' || n::text;
    END LOOP;

    INSERT INTO public.shops (
      owner_user_id, name, subscription_status, trial_ends_at, slug, segment
    )
    VALUES (
      NEW.id, v_name, 'trial', now() + INTERVAL '30 days', v_slug, v_segment
    )
    ON CONFLICT (owner_user_id) DO NOTHING;

    SELECT id INTO v_shop_id FROM public.shops WHERE owner_user_id = NEW.id;
    IF v_shop_id IS NOT NULL THEN
      PERFORM public.attach_shop_referral(
        v_shop_id,
        NEW.raw_user_meta_data->>'referral_code'
      );
    END IF;
  END IF;

  IF NEW.raw_user_meta_data->>'role' = 'client' THEN
    INSERT INTO public.clients (id, name, phone)
    VALUES (
      NEW.id,
      COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''), 'Cliente'),
      NULLIF(TRIM(NEW.raw_user_meta_data->>'phone'), '')
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_referral_code() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_referral_code(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.attach_shop_referral(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.convert_shop_referral(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_referral_event(TEXT, UUID, UUID, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_referral_owner(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.normalize_referral_code(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.attach_my_referral(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_referral_reward(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_referral_overview() TO authenticated;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.shops LOOP
    PERFORM public.ensure_referral_code(r.id);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
