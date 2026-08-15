-- Restore non-public access to booking_services after dropping anonymous policies.
-- Public booking flows use finalize_public_booking / get_booking_receipt (SECURITY DEFINER).

CREATE POLICY "Owners manage own booking services"
  ON public.booking_services FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings bk
      WHERE bk.id = booking_services.booking_id
        AND public.is_shop_owner(bk.shop_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bookings bk
      WHERE bk.id = booking_services.booking_id
        AND public.is_shop_owner(bk.shop_id)
    )
  );

CREATE POLICY "Logged clients read own booking services"
  ON public.booking_services FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings bk
      WHERE bk.id = booking_services.booking_id
        AND bk.client_id = auth.uid()
    )
  );
