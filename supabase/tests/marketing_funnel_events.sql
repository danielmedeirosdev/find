-- Rolled back: verifies public ingestion without opening read/write access.
begin;
set local role anon;
insert into public.marketing_funnel_events(session_id,event_name,method,stage,page_path,is_test)
values ('11111111-1111-4111-8111-111111111111','signup_error','google','google_auth','/painel',true);
do $$ begin
  begin
    perform id from public.marketing_funnel_events;
    raise exception 'Anonymous diagnostics read must be denied';
  exception when insufficient_privilege then null; end;
  begin
    update public.marketing_funnel_events set is_test = false;
    raise exception 'Anonymous diagnostics update must be denied';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.marketing_funnel_events;
    raise exception 'Anonymous diagnostics delete must be denied';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.marketing_funnel_events(session_id,event_name,page_path,stage)
    values ('11111111-1111-4111-8111-111111111111','signup_error','/painel','arbitrary raw error');
    raise exception 'Unbounded stage must be denied';
  exception when check_violation then null; end;
end $$;
reset role;

set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"22222222-2222-4222-8222-222222222222","app_metadata":{}}';
insert into public.marketing_funnel_events(session_id,event_name,page_path,is_test)
values ('11111111-1111-4111-8111-111111111111','signup_view','/painel',true);
do $$ begin
  if exists (select 1 from public.marketing_funnel_events) then
    raise exception 'Ordinary signed-in users must not read diagnostic rows';
  end if;
  begin
    update public.marketing_funnel_events set is_test = false;
    raise exception 'Ordinary signed-in diagnostics update must be denied';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.marketing_funnel_events;
    raise exception 'Ordinary signed-in diagnostics delete must be denied';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
