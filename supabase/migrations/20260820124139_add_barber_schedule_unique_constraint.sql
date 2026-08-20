-- A professional can only have one schedule row for each weekday.
-- The onboarding RPC relies on this key to make schedule creation idempotent.
ALTER TABLE public.barber_schedule
  ADD CONSTRAINT barber_schedule_barber_id_day_of_week_key
  UNIQUE (barber_id, day_of_week);
