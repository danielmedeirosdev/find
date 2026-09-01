DROP POLICY IF EXISTS "Owners manage professional time off" ON public.barber_time_off;
DROP POLICY IF EXISTS "Staff manage own time off" ON public.barber_time_off;

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
