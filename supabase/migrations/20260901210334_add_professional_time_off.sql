-- Folgas, férias e bloqueios pontuais da agenda por profissional.
-- A tabela interna mantém o motivo privado; a view pública expõe apenas o
-- necessário para calcular horários disponíveis no agendamento online.

CREATE TABLE public.barber_time_off (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  barber_id uuid NOT NULL REFERENCES public.barbers(id) ON DELETE CASCADE,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  start_time time,
  end_time time,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT barber_time_off_date_order CHECK (ends_on >= starts_on),
  CONSTRAINT barber_time_off_time_pair CHECK (
    (start_time IS NULL AND end_time IS NULL)
    OR (start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time)
  )
);

CREATE INDEX barber_time_off_barber_dates_idx
  ON public.barber_time_off (barber_id, starts_on, ends_on);
CREATE INDEX barber_time_off_shop_idx
  ON public.barber_time_off (shop_id);

ALTER TABLE public.barber_time_off ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public reads safe professional time off"
  ON public.barber_time_off
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.shops s
      WHERE s.id = barber_time_off.shop_id
        AND s.subscription_status <> 'blocked'
    )
  );

CREATE POLICY "Authorized users insert professional time off"
  ON public.barber_time_off FOR INSERT TO authenticated
  WITH CHECK (
    public.is_shop_owner(shop_id)
    OR EXISTS (SELECT 1 FROM public.barbers b WHERE b.id = barber_id AND b.shop_id = shop_id AND b.user_id = (SELECT auth.uid()))
  );
CREATE POLICY "Authorized users update professional time off"
  ON public.barber_time_off FOR UPDATE TO authenticated
  USING (
    public.is_shop_owner(shop_id)
    OR EXISTS (SELECT 1 FROM public.barbers b WHERE b.id = barber_id AND b.shop_id = shop_id AND b.user_id = (SELECT auth.uid()))
  )
  WITH CHECK (
    public.is_shop_owner(shop_id)
    OR EXISTS (SELECT 1 FROM public.barbers b WHERE b.id = barber_id AND b.shop_id = shop_id AND b.user_id = (SELECT auth.uid()))
  );
CREATE POLICY "Authorized users delete professional time off"
  ON public.barber_time_off FOR DELETE TO authenticated
  USING (
    public.is_shop_owner(shop_id)
    OR EXISTS (SELECT 1 FROM public.barbers b WHERE b.id = barber_id AND b.shop_id = shop_id AND b.user_id = (SELECT auth.uid()))
  );

REVOKE ALL ON public.barber_time_off FROM PUBLIC;
GRANT SELECT ON public.barber_time_off TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.barber_time_off TO authenticated;

CREATE OR REPLACE FUNCTION private.validate_barber_time_off_shop()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.barbers b
    WHERE b.id = NEW.barber_id AND b.shop_id = NEW.shop_id
  ) THEN
    RAISE EXCEPTION 'O profissional não pertence a este estabelecimento.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_barber_time_off_shop_trigger
  BEFORE INSERT OR UPDATE ON public.barber_time_off
  FOR EACH ROW EXECUTE FUNCTION private.validate_barber_time_off_shop();

CREATE OR REPLACE FUNCTION private.reject_booking_during_time_off()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  booking_start integer;
  booking_end integer;
BEGIN
  IF COALESCE(NEW.status, 'scheduled') IN ('cancelled', 'no_show') THEN
    RETURN NEW;
  END IF;

  booking_start := extract(hour FROM NEW.time)::integer * 60
    + extract(minute FROM NEW.time)::integer;
  booking_end := booking_start + GREATEST(COALESCE(NEW.duration_minutes, 30), 1);

  IF EXISTS (
    SELECT 1
    FROM public.barber_time_off t
    WHERE t.shop_id = NEW.shop_id
      AND t.barber_id = NEW.barber_id
      AND NEW.date BETWEEN t.starts_on AND t.ends_on
      AND (
        t.start_time IS NULL
        OR (
          booking_start < extract(hour FROM t.end_time)::integer * 60
            + extract(minute FROM t.end_time)::integer
          AND extract(hour FROM t.start_time)::integer * 60
            + extract(minute FROM t.start_time)::integer < booking_end
        )
      )
  ) THEN
    RAISE EXCEPTION 'Este profissional está de folga ou indisponível nesse horário.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER reject_booking_during_time_off_trigger
  BEFORE INSERT OR UPDATE OF shop_id, barber_id, date, time, duration_minutes
  ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION private.reject_booking_during_time_off();

REVOKE ALL ON FUNCTION private.validate_barber_time_off_shop() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.reject_booking_during_time_off() FROM PUBLIC, anon, authenticated;
