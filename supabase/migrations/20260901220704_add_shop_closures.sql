-- Feriados, recessos e fechamentos que bloqueiam o estabelecimento inteiro.
-- O motivo é público porque também orienta o cliente na página de agendamento.

CREATE TABLE public.shop_closures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  label text NOT NULL DEFAULT 'Fechado',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shop_closures_date_order CHECK (ends_on >= starts_on),
  CONSTRAINT shop_closures_label_length CHECK (
    char_length(btrim(label)) BETWEEN 1 AND 120
  )
);

CREATE INDEX shop_closures_shop_dates_idx
  ON public.shop_closures (shop_id, starts_on, ends_on);

ALTER TABLE public.shop_closures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public reads closures of available shops"
  ON public.shop_closures
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.shops s
      WHERE s.id = shop_closures.shop_id
        AND s.subscription_status <> 'blocked'
    )
  );

CREATE POLICY "Owners insert shop closures"
  ON public.shop_closures
  FOR INSERT TO authenticated
  WITH CHECK (public.is_shop_owner(shop_id));

CREATE POLICY "Owners update shop closures"
  ON public.shop_closures
  FOR UPDATE TO authenticated
  USING (public.is_shop_owner(shop_id))
  WITH CHECK (public.is_shop_owner(shop_id));

CREATE POLICY "Owners delete shop closures"
  ON public.shop_closures
  FOR DELETE TO authenticated
  USING (public.is_shop_owner(shop_id));

REVOKE ALL ON public.shop_closures FROM PUBLIC;
GRANT SELECT ON public.shop_closures TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_closures TO authenticated;

CREATE OR REPLACE FUNCTION private.reject_booking_during_shop_closure()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  closure_label text;
BEGIN
  IF COALESCE(NEW.status, 'scheduled') NOT IN (
    'scheduled', 'confirmed', 'in_progress', 'awaiting_payment'
  ) THEN
    RETURN NEW;
  END IF;

  SELECT c.label
    INTO closure_label
  FROM public.shop_closures c
  WHERE c.shop_id = NEW.shop_id
    AND NEW.date BETWEEN c.starts_on AND c.ends_on
  ORDER BY c.starts_on
  LIMIT 1;

  IF closure_label IS NOT NULL THEN
    RAISE EXCEPTION 'O estabelecimento está fechado nesta data: %.', closure_label
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER reject_booking_during_shop_closure_trigger
  BEFORE INSERT OR UPDATE OF shop_id, date, status
  ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION private.reject_booking_during_shop_closure();

REVOKE ALL ON FUNCTION private.reject_booking_during_shop_closure()
  FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.shop_closures IS
  'Feriados, recessos e outros períodos em que o estabelecimento inteiro não abre.';

NOTIFY pgrst, 'reload schema';
