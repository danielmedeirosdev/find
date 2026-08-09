-- Horários ocupados para a agenda pública + unique só em bookings ativos
-- (cancelled/no_show liberam o horário de novo)

CREATE OR REPLACE VIEW public.public_booking_slots
WITH (security_invoker = true)
AS
SELECT
  shop_id,
  barber_id,
  date,
  time
FROM public.bookings
WHERE status IN ('scheduled', 'in_progress', 'completed')
  AND date >= CURRENT_DATE;

GRANT SELECT ON public.public_booking_slots TO anon, authenticated;

-- Troca UNIQUE rígido por índice parcial (libera cancelled / no_show)
ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_barber_id_date_time_key;

DROP INDEX IF EXISTS public.bookings_barber_id_date_time_key;

CREATE UNIQUE INDEX IF NOT EXISTS bookings_active_slot_uidx
  ON public.bookings (barber_id, date, time)
  WHERE status NOT IN ('cancelled', 'no_show');
