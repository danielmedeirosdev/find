alter table public.bookings
  add column if not exists confirmation_reminder_minutes integer,
  add column if not exists confirmation_reminder_sent_at timestamptz;

alter table public.bookings
  drop constraint if exists bookings_confirmation_reminder_minutes_check;

alter table public.bookings
  add constraint bookings_confirmation_reminder_minutes_check
  check (confirmation_reminder_minutes is null or confirmation_reminder_minutes in (30,60,120,1440));

create or replace function public.process_booking_confirmation_reminders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  rec record;
begin
  for rec in
    select b.id, b.shop_id, b.client_name, b.date, b.time, b.confirmation_reminder_minutes
    from public.bookings b
    where b.status = 'scheduled'
      and b.confirmation_reminder_minutes is not null
      and b.confirmation_reminder_sent_at is null
      and ((b.date + b.time) at time zone 'America/Sao_Paulo') > now()
      and ((b.date + b.time) at time zone 'America/Sao_Paulo') - make_interval(mins => b.confirmation_reminder_minutes) <= now()
  loop
    insert into public.notifications (shop_id, audience, kind, title, body, booking_id)
    values (
      rec.shop_id,
      'owner',
      'booking_confirmation_reminder',
      'Hora de confirmar o atendimento',
      rec.client_name || ' · ' || to_char(rec.date, 'DD/MM') || ' às ' || to_char(rec.time, 'HH24:MI'),
      rec.id
    );

    update public.bookings
      set confirmation_reminder_sent_at = now()
      where id = rec.id and confirmation_reminder_sent_at is null;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.process_booking_confirmation_reminders() from public, anon, authenticated;
grant execute on function public.process_booking_confirmation_reminders() to service_role;

create extension if not exists pg_cron;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'onefind-confirmation-reminders') then
    perform cron.unschedule('onefind-confirmation-reminders');
  end if;
  perform cron.schedule(
    'onefind-confirmation-reminders',
    '* * * * *',
    'select public.process_booking_confirmation_reminders();'
  );
end $$;
