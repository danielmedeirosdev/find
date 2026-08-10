-- Observações no agendamento + até 2 pets da mesma pessoa no mesmo horário
-- (um booking ocupa o slot; vários pets via booking_pets)

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE TABLE IF NOT EXISTS public.booking_pets (
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  pet_id UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  PRIMARY KEY (booking_id, pet_id)
);

CREATE INDEX IF NOT EXISTS idx_booking_pets_pet ON public.booking_pets(pet_id);

-- No máximo 2 pets por agendamento
CREATE OR REPLACE FUNCTION public.enforce_booking_pets_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  n INT;
BEGIN
  SELECT COUNT(*) INTO n FROM public.booking_pets WHERE booking_id = NEW.booking_id;
  IF n > 2 THEN
    RAISE EXCEPTION 'Máximo de 2 pets por horário (mesma pessoa).';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_booking_pets_limit ON public.booking_pets;
CREATE TRIGGER trg_booking_pets_limit
  AFTER INSERT ON public.booking_pets
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_booking_pets_limit();

ALTER TABLE public.booking_pets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read booking pets" ON public.booking_pets;
CREATE POLICY "Public read booking pets" ON public.booking_pets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      JOIN public.shops s ON s.id = b.shop_id
      WHERE b.id = booking_pets.booking_id
        AND s.subscription_status != 'blocked'
    )
  );

DROP POLICY IF EXISTS "Anyone can insert booking pets" ON public.booking_pets;
CREATE POLICY "Anyone can insert booking pets" ON public.booking_pets
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bookings b
      JOIN public.shops s ON s.id = b.shop_id
      WHERE b.id = booking_pets.booking_id
        AND s.subscription_status != 'blocked'
    )
  );

DROP POLICY IF EXISTS "Owners manage booking pets" ON public.booking_pets;
CREATE POLICY "Owners manage booking pets" ON public.booking_pets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_pets.booking_id
        AND public.is_shop_owner(b.shop_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_pets.booking_id
        AND public.is_shop_owner(b.shop_id)
    )
  );

-- Backfill a partir de bookings.pet_id
INSERT INTO public.booking_pets (booking_id, pet_id)
SELECT id, pet_id
FROM public.bookings
WHERE pet_id IS NOT NULL
ON CONFLICT DO NOTHING;
