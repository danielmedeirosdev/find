-- Relação opcional entre serviços e profissionais.
-- Sem linhas para um serviço = todos os profissionais podem executá-lo,
-- preservando integralmente o comportamento dos cadastros atuais.
CREATE TABLE public.service_barbers (
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  barber_id uuid NOT NULL REFERENCES public.barbers(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (service_id, barber_id)
);

CREATE INDEX service_barbers_shop_idx ON public.service_barbers (shop_id);
CREATE INDEX service_barbers_barber_idx ON public.service_barbers (barber_id, service_id);

ALTER TABLE public.service_barbers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public reads service professionals"
  ON public.service_barbers FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.shops s
      WHERE s.id = service_barbers.shop_id
        AND s.subscription_status <> 'blocked'
    )
  );
CREATE POLICY "Owners add service professionals"
  ON public.service_barbers FOR INSERT TO authenticated
  WITH CHECK (public.is_shop_owner(shop_id));
CREATE POLICY "Owners remove service professionals"
  ON public.service_barbers FOR DELETE TO authenticated
  USING (public.is_shop_owner(shop_id));

REVOKE ALL ON public.service_barbers FROM PUBLIC;
GRANT SELECT ON public.service_barbers TO anon;
GRANT SELECT, INSERT, DELETE ON public.service_barbers TO authenticated;

CREATE OR REPLACE FUNCTION private.validate_service_barber_shop()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.services s
    JOIN public.barbers b ON b.shop_id = s.shop_id
    WHERE s.id = NEW.service_id
      AND b.id = NEW.barber_id
      AND s.shop_id = NEW.shop_id
  ) THEN
    RAISE EXCEPTION 'Serviço e profissional precisam pertencer ao mesmo estabelecimento.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_service_barber_shop_trigger
  BEFORE INSERT OR UPDATE ON public.service_barbers
  FOR EACH ROW EXECUTE FUNCTION private.validate_service_barber_shop();

CREATE OR REPLACE FUNCTION private.reject_unqualified_booking_service()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_barber_id uuid;
BEGIN
  SELECT b.barber_id INTO v_barber_id
  FROM public.bookings b
  WHERE b.id = NEW.booking_id;

  IF EXISTS (SELECT 1 FROM public.service_barbers sb WHERE sb.service_id = NEW.service_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.service_barbers sb
      WHERE sb.service_id = NEW.service_id AND sb.barber_id = v_barber_id
    ) THEN
    RAISE EXCEPTION 'O profissional escolhido não executa um dos serviços selecionados.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER reject_unqualified_booking_service_trigger
  BEFORE INSERT OR UPDATE ON public.booking_services
  FOR EACH ROW EXECUTE FUNCTION private.reject_unqualified_booking_service();

REVOKE ALL ON FUNCTION private.validate_service_barber_shop() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.reject_unqualified_booking_service() FROM PUBLIC, anon, authenticated;
