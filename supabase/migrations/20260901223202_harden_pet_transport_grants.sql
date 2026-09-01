-- A configuração é pública apenas para leitura durante o agendamento.
-- Somente proprietários autenticados podem alterá-la, conforme as políticas RLS.
-- Configurações antigas por serviço são consolidadas como uma escolha única do
-- estabelecimento, preservando o maior valor ativo já cadastrado.
ALTER TABLE public.service_pet_transport
  ADD COLUMN pricing_mode text NOT NULL DEFAULT 'fixed';

ALTER TABLE public.service_pet_transport
  ADD CONSTRAINT service_pet_transport_pricing_mode_check
    CHECK (pricing_mode IN ('quote', 'fixed')),
  ADD CONSTRAINT service_pet_transport_quote_has_no_fee_check
    CHECK (pricing_mode = 'fixed' OR fee = 0);

WITH shop_transport AS (
  SELECT
    shop_id,
    bool_or(enabled) AS enabled,
    COALESCE(max(fee) FILTER (WHERE enabled), 0) AS fee,
    CASE
      WHEN bool_or(enabled AND pricing_mode = 'quote') THEN 'quote'
      ELSE 'fixed'
    END AS pricing_mode
  FROM public.service_pet_transport
  GROUP BY shop_id
)
INSERT INTO public.service_pet_transport (shop_id, service_id, enabled, fee, pricing_mode)
SELECT
  s.shop_id,
  s.id,
  st.enabled,
  CASE WHEN st.pricing_mode = 'quote' THEN 0 ELSE st.fee END,
  st.pricing_mode
FROM public.services s
JOIN shop_transport st ON st.shop_id = s.shop_id
ON CONFLICT (service_id) DO UPDATE SET
  enabled = EXCLUDED.enabled,
  fee = EXCLUDED.fee,
  pricing_mode = EXCLUDED.pricing_mode,
  updated_at = now();

REVOKE ALL ON public.service_pet_transport FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.service_pet_transport TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_pet_transport TO authenticated;

CREATE OR REPLACE FUNCTION public.set_pet_transport_fee(
  p_booking_id uuid,
  p_fee numeric
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_shop_id uuid;
  v_requested boolean;
  v_base numeric(12,2);
  v_total numeric(12,2);
BEGIN
  IF p_fee IS NULL OR p_fee < 0 OR p_fee > 999999.99 THEN
    RAISE EXCEPTION 'Valor do Táxi Pet inválido';
  END IF;

  SELECT
    b.shop_id,
    b.pet_transport_requested,
    COALESCE(
      b.services_amount + COALESCE(b.extras_amount, 0),
      GREATEST(COALESCE(b.quoted_amount, 0) - COALESCE(b.pet_transport_fee, 0), 0)
    )
  INTO v_shop_id, v_requested, v_base
  FROM public.bookings b
  WHERE b.id = p_booking_id
  FOR UPDATE;

  IF v_shop_id IS NULL THEN
    RAISE EXCEPTION 'Agendamento não encontrado';
  END IF;
  IF NOT (public.is_shop_owner(v_shop_id) OR public.is_booking_assignee(p_booking_id)) THEN
    RAISE EXCEPTION 'Sem permissão para definir o valor do Táxi Pet';
  END IF;
  IF NOT v_requested THEN
    RAISE EXCEPTION 'Este agendamento não solicitou Táxi Pet';
  END IF;

  v_total := round(v_base + p_fee, 2);
  UPDATE public.bookings
  SET
    pet_transport_fee = round(p_fee, 2),
    quoted_amount = v_total
  WHERE id = p_booking_id;

  RETURN v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.set_pet_transport_fee(uuid, numeric)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_pet_transport_fee(uuid, numeric)
  TO authenticated;

NOTIFY pgrst, 'reload schema';
