-- Keep the original usage as an audit record when an owner corrects a manual debit.
ALTER TABLE public.package_usages
  ADD COLUMN IF NOT EXISTS reversed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reversed_by uuid REFERENCES auth.users(id);

CREATE OR REPLACE FUNCTION public.reverse_manual_package_usage(p_usage_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_usage public.package_usages%ROWTYPE;
  v_package public.customer_packages%ROWTYPE;
BEGIN
  SELECT * INTO v_usage FROM public.package_usages WHERE id = p_usage_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Uso não encontrado'; END IF;

  SELECT * INTO v_package FROM public.customer_packages
    WHERE id = v_usage.customer_package_id FOR UPDATE;
  IF NOT FOUND OR NOT public.is_shop_owner(v_package.shop_id) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  -- Manual entries are the only ones safe to reverse without changing a booking.
  IF v_usage.booking_id IS NOT NULL OR v_usage.note IS DISTINCT FROM 'Uso manual' THEN
    RAISE EXCEPTION 'Uso de atendimento não pode ser estornado aqui';
  END IF;
  IF v_usage.reversed_at IS NOT NULL THEN RETURN; END IF;
  IF v_package.used_sessions < 1 THEN RAISE EXCEPTION 'Saldo inconsistente'; END IF;

  UPDATE public.package_usages SET reversed_at = now(), reversed_by = auth.uid()
    WHERE id = p_usage_id AND reversed_at IS NULL;
  IF NOT FOUND THEN RETURN; END IF;
  UPDATE public.customer_packages SET
    used_sessions = used_sessions - 1,
    status = CASE
      WHEN status = 'cancelled' THEN status
      WHEN expires_at IS NOT NULL AND expires_at < current_date THEN 'expired'
      ELSE 'active'
    END
    WHERE id = v_package.id;
END;
$$;

REVOKE ALL ON FUNCTION public.reverse_manual_package_usage(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reverse_manual_package_usage(uuid) TO authenticated;
