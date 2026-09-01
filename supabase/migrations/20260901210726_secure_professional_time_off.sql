-- Substitui a view security-definer por leitura direta protegida por RLS.
DROP VIEW IF EXISTS public.public_barber_time_off;

ALTER TABLE public.barber_time_off
  DROP COLUMN IF EXISTS reason;

DROP POLICY IF EXISTS "Public reads safe professional time off" ON public.barber_time_off;
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

REVOKE ALL ON public.barber_time_off FROM PUBLIC;
GRANT SELECT ON public.barber_time_off TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.barber_time_off TO authenticated;
