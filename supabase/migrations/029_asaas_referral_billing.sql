-- Integração real da recompensa de indicação com a assinatura Asaas.
-- Asaas não tem "pular fatura": o benefício de assinante é adiar nextDueDate
-- e remover cobranças PENDING da recorrência. Trial sem assinatura estende
-- trial_ends_at; create-subscription usa complimentary_until como nextDueDate.

ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS asaas_subscription_id TEXT;

ALTER TABLE public.referral_rewards
  DROP CONSTRAINT IF EXISTS referral_rewards_status_check;

ALTER TABLE public.referral_rewards
  ADD CONSTRAINT referral_rewards_status_check
  CHECK (status IN ('available', 'applying', 'redeemed'));

ALTER TABLE public.referral_rewards
  ADD COLUMN IF NOT EXISTS applied_via TEXT,
  ADD COLUMN IF NOT EXISTS asaas_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS asaas_next_due_before DATE,
  ADD COLUMN IF NOT EXISTS asaas_next_due_after DATE,
  ADD COLUMN IF NOT EXISTS apply_error TEXT,
  ADD COLUMN IF NOT EXISTS apply_started_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.protect_shop_asaas_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'authenticated' THEN
    NEW.asaas_customer_id := OLD.asaas_customer_id;
    NEW.asaas_subscription_id := OLD.asaas_subscription_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS shops_protect_asaas_columns ON public.shops;
CREATE TRIGGER shops_protect_asaas_columns
  BEFORE UPDATE ON public.shops
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_shop_asaas_columns();

CREATE OR REPLACE FUNCTION public.lock_referral_reward(p_reward_id UUID, p_owner_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop UUID;
  v_reward public.referral_rewards%ROWTYPE;
  v_updated INTEGER;
BEGIN
  SELECT id INTO v_shop
  FROM public.shops
  WHERE owner_user_id = p_owner_user_id;

  IF v_shop IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_shop');
  END IF;

  SELECT * INTO v_reward
  FROM public.referral_rewards
  WHERE id = p_reward_id
  FOR UPDATE;

  IF v_reward.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF v_reward.shop_id <> v_shop THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  IF v_reward.status = 'redeemed' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_redeemed');
  END IF;

  IF v_reward.status = 'applying' THEN
    IF v_reward.apply_started_at IS NULL
       OR v_reward.apply_started_at > now() - interval '5 minutes' THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'in_progress');
    END IF;
  END IF;

  UPDATE public.referral_rewards
  SET status = 'applying', apply_started_at = now(), apply_error = NULL
  WHERE id = p_reward_id
    AND (
      status = 'available'
      OR (status = 'applying' AND apply_started_at < now() - interval '5 minutes')
    );
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_available');
  END IF;

  SELECT * INTO v_reward FROM public.referral_rewards WHERE id = p_reward_id;

  RETURN jsonb_build_object(
    'ok', true,
    'reason', 'locked',
    'reward', jsonb_build_object(
      'id', v_reward.id,
      'shop_id', v_reward.shop_id,
      'months', v_reward.months,
      'referral_id', v_reward.referral_id,
      'asaas_subscription_id', v_reward.asaas_subscription_id,
      'asaas_next_due_before', v_reward.asaas_next_due_before,
      'asaas_next_due_after', v_reward.asaas_next_due_after,
      'applied_via', v_reward.applied_via
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.release_referral_reward(p_reward_id UUID, p_error TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.referral_rewards
  SET
    status = 'available',
    apply_error = left(COALESCE(p_error, 'unknown'), 500),
    apply_started_at = NULL
  WHERE id = p_reward_id
    AND status = 'applying';

  INSERT INTO public.referral_events (kind, referral_id, shop_id, payload)
  SELECT
    'reward_application_failed',
    rw.referral_id,
    rw.shop_id,
    jsonb_build_object('reward_id', rw.id, 'error', left(COALESCE(p_error, 'unknown'), 500))
  FROM public.referral_rewards rw
  WHERE rw.id = p_reward_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_referral_reward(
  p_reward_id UUID,
  p_applied_via TEXT,
  p_asaas_subscription_id TEXT DEFAULT NULL,
  p_next_due_before DATE DEFAULT NULL,
  p_next_due_after DATE DEFAULT NULL
)
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

  IF v_reward.status = 'redeemed' THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'already_redeemed');
  END IF;

  IF v_reward.status <> 'applying' THEN
    RAISE EXCEPTION 'Recompensa não está em aplicação';
  END IF;

  SELECT * INTO v_shop FROM public.shops WHERE id = v_reward.shop_id FOR UPDATE;

  IF p_applied_via = 'asaas_postpone' AND p_next_due_after IS NOT NULL THEN
    v_until := (p_next_due_after::timestamp + interval '12 hours') AT TIME ZONE 'UTC';
  ELSE
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
  END IF;

  UPDATE public.referral_rewards
  SET
    status = 'redeemed',
    redeemed_at = now(),
    applied_via = p_applied_via,
    asaas_subscription_id = p_asaas_subscription_id,
    asaas_next_due_before = p_next_due_before,
    asaas_next_due_after = p_next_due_after,
    apply_error = NULL,
    apply_started_at = NULL
  WHERE id = p_reward_id
    AND status = 'applying';
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'already_redeemed');
  END IF;

  UPDATE public.shops
  SET
    complimentary_until = v_until,
    asaas_subscription_id = COALESCE(p_asaas_subscription_id, asaas_subscription_id),
    trial_ends_at = CASE
      WHEN p_applied_via = 'trial_extension' THEN v_until
      WHEN subscription_status IN ('trial', 'blocked')
           AND COALESCE(asaas_subscription_id, p_asaas_subscription_id) IS NULL
        THEN v_until
      ELSE trial_ends_at
    END,
    subscription_status = CASE
      WHEN p_applied_via = 'trial_extension' AND subscription_status = 'blocked' THEN 'trial'
      WHEN subscription_status = 'blocked'
           AND COALESCE(asaas_subscription_id, p_asaas_subscription_id) IS NULL
        THEN 'trial'
      ELSE subscription_status
    END
  WHERE id = v_shop.id;

  INSERT INTO public.referral_events (kind, referral_id, shop_id, payload)
  VALUES (
    'reward_applied',
    v_reward.referral_id,
    v_reward.shop_id,
    jsonb_build_object(
      'reward_id', v_reward.id,
      'months', v_reward.months,
      'applied_via', p_applied_via,
      'asaas_subscription_id', p_asaas_subscription_id,
      'next_due_before', p_next_due_before,
      'next_due_after', p_next_due_after
    )
  );

  INSERT INTO public.referral_events (kind, referral_id, shop_id, payload)
  VALUES (
    'billing_reward_processed',
    v_reward.referral_id,
    v_reward.shop_id,
    jsonb_build_object(
      'reward_id', v_reward.id,
      'months', v_reward.months,
      'applied_via', p_applied_via,
      'asaas_subscription_id', p_asaas_subscription_id,
      'next_due_before', p_next_due_before,
      'next_due_after', p_next_due_after
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'reason', 'redeemed',
    'months', v_reward.months,
    'applied_via', p_applied_via,
    'complimentary_until', v_until
  );
END;
$$;

-- Overview: não devolve IDs Asaas ao cliente
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
    COALESCE(sum(months) FILTER (WHERE status IN ('available', 'applying')), 0)::int,
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
      'status', CASE WHEN rw.status = 'applying' THEN 'available' ELSE rw.status END,
      'granted_at', rw.granted_at,
      'redeemed_at', rw.redeemed_at,
      'applied_via', rw.applied_via,
      'next_charge_on', rw.asaas_next_due_after
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

REVOKE ALL ON FUNCTION public.lock_referral_reward(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_referral_reward(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finalize_referral_reward(UUID, TEXT, TEXT, DATE, DATE) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.redeem_referral_reward(UUID) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.lock_referral_reward(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_referral_reward(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_referral_reward(UUID, TEXT, TEXT, DATE, DATE) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_my_referral_overview() TO authenticated;

CREATE INDEX IF NOT EXISTS idx_shops_asaas_subscription
  ON public.shops (asaas_subscription_id)
  WHERE asaas_subscription_id IS NOT NULL;

REVOKE SELECT, INSERT, UPDATE, REFERENCES (asaas_subscription_id) ON public.shops FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, REFERENCES (asaas_customer_id) ON public.shops FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
