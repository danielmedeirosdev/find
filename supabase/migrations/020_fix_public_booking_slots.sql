-- Alinha public_booking_slots ao índice único bookings_active_slot_uidx:
-- qualquer status que NÃO seja cancelled/no_show continua ocupando o horário.

CREATE OR REPLACE VIEW public.public_booking_slots
WITH (security_invoker = true)
AS
SELECT
  shop_id,
  barber_id,
  date,
  time,
  COALESCE(duration_minutes, 30) AS duration_minutes
FROM public.bookings
WHERE status IS NULL
   OR status NOT IN ('cancelled', 'no_show');

GRANT SELECT ON public.public_booking_slots TO anon, authenticated;
