-- Public scheduling needs the same authoritative time used by the write guard.
-- No tenant/user data is returned and no elevated privileges are needed.
create function public.current_booking_time()
returns timestamptz language sql volatile security invoker set search_path='' as $$
  select clock_timestamp();
$$;
revoke all on function public.current_booking_time() from public;
grant execute on function public.current_booking_time() to anon,authenticated;
