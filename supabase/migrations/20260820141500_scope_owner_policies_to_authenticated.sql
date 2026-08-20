-- Owner-management policies used to apply to the implicit PUBLIC role.
-- Anonymous reads then evaluated owner-only subqueries against shops and failed
-- with 42501 before the dedicated public SELECT policies could return data.

DROP POLICY IF EXISTS "dono gerencia services" ON public.services;
CREATE POLICY "dono gerencia services"
  ON public.services
  FOR ALL
  TO authenticated
  USING (
    shop_id IN (
      SELECT shops.id
      FROM public.shops
      WHERE shops.owner_user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "dono gerencia barbers" ON public.barbers;
CREATE POLICY "dono gerencia barbers"
  ON public.barbers
  FOR ALL
  TO authenticated
  USING (
    shop_id IN (
      SELECT shops.id
      FROM public.shops
      WHERE shops.owner_user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "dono gerencia agenda" ON public.barber_schedule;
CREATE POLICY "dono gerencia agenda"
  ON public.barber_schedule
  FOR ALL
  TO authenticated
  USING (
    barber_id IN (
      SELECT b.id
      FROM public.barbers b
      JOIN public.shops s ON s.id = b.shop_id
      WHERE s.owner_user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Owners manage shop photos" ON public.shop_photos;
CREATE POLICY "Owners manage shop photos"
  ON public.shop_photos
  FOR ALL
  TO authenticated
  USING (
    shop_id IN (
      SELECT shops.id
      FROM public.shops
      WHERE shops.owner_user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    shop_id IN (
      SELECT shops.id
      FROM public.shops
      WHERE shops.owner_user_id = (SELECT auth.uid())
    )
  );
