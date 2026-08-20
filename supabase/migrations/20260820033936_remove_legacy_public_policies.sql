BEGIN;

-- Remove drifted policies from early production setup. These policies were
-- created TO PUBLIC and either exposed sensitive source rows or ignored a
-- blocked shop's status.
DROP POLICY IF EXISTS "Public can read active shops" ON public.shops;
DROP POLICY IF EXISTS "publico le lojas ativas" ON public.shops;

DROP POLICY IF EXISTS "Public can read barbers of active shops" ON public.barbers;
DROP POLICY IF EXISTS "publico le barbers" ON public.barbers;

DROP POLICY IF EXISTS "publico le services" ON public.services;
DROP POLICY IF EXISTS "publico le agenda" ON public.barber_schedule;

-- Public visitors use public_barbers. Authenticated owners keep their tenant
-- policy and a professional can read only their own linked source profile.
REVOKE ALL ON public.barbers FROM PUBLIC, anon;

DROP POLICY IF EXISTS "Staff read own barber profile" ON public.barbers;
CREATE POLICY "Staff read own barber profile"
  ON public.barbers
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Schedule visibility now depends only on the safe professional projection.
DROP POLICY IF EXISTS "Public can read schedules of active shops"
  ON public.barber_schedule;
CREATE POLICY "Public can read schedules of active shops"
  ON public.barber_schedule
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.public_barbers pb
      WHERE pb.id = barber_schedule.barber_id
    )
  );

NOTIFY pgrst, 'reload schema';

COMMIT;
