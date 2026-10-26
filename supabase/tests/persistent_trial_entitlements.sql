-- Run inside BEGIN / ROLLBACK. All identities are generated fictitious accounts.
do $$
declare u uuid:=gen_random_uuid(); u2 uuid; sh uuid; v_email text:='qa.trial.'||gen_random_uuid()||'@example.com'; v_end timestamptz; v_first timestamptz;
begin
  insert into auth.users(id,email,raw_user_meta_data) values(u,v_email,'{"role":"barber","segment":"pet","shop_name":"QA trial"}');
  select id,trial_ends_at into sh,v_first from public.shops where owner_user_id=u;
  if abs(extract(epoch from (v_first-now()-interval '30 days')))>5 then raise exception 'FAIL new email does not receive 30 days'; end if;
  if private.trial_email_fingerprint(v_email)<>private.trial_email_fingerprint('  '||upper(v_email)||' ') then raise exception 'FAIL email normalization'; end if;
  -- Simulate day 29 using only this isolated account's entitlement.
  v_end:=now()+interval '1 day';
  update private.trial_entitlements set expires_at=v_end where email_fingerprint=private.trial_email_fingerprint(v_email);
  perform set_config('request.jwt.claim.sub',u::text,true);
  perform public.delete_own_shop();
  if exists(select 1 from auth.users where id=u) or exists(select 1 from public.shops where id=sh) then raise exception 'FAIL deletion did not remove account'; end if;
  u2:=gen_random_uuid();
  insert into auth.users(id,email,raw_user_meta_data) values(u2,upper(v_email),'{"role":"barber","segment":"pet","shop_name":"QA trial recreated"}');
  select id,trial_ends_at into sh,v_first from public.shops where owner_user_id=u2;
  if v_first<>v_end then raise exception 'FAIL recreated account reset its trial'; end if;
  if (select subscription_status from public.shops where id=sh)<>'trial' then raise exception 'FAIL remaining trial not usable'; end if;
  -- A changed email carries the same deadline; the old email remains registered.
  update auth.users set email='changed.'||v_email where id=u2;
  if (select expires_at from private.trial_entitlements where email_fingerprint=private.trial_email_fingerprint('changed.'||v_email))<>v_end then raise exception 'FAIL email change lost deadline'; end if;
  update private.trial_entitlements set expires_at=now()-interval '1 day' where email_fingerprint=private.trial_email_fingerprint(v_email);
  -- Direct/fallback shop creation cannot bypass the server deadline or billing.
  delete from public.shops where id=sh;
  update auth.users set email=v_email where id=u2;
  perform set_config('request.jwt.claims',json_build_object('sub',u2,'role','authenticated')::text,true);
  insert into public.shops(owner_user_id,name,segment,subscription_status,trial_ends_at)
  values(u2,'QA forged trial','pet','active',now()+interval '1000 days') returning id into sh;
  if (select subscription_status from public.shops where id=sh)<>'blocked' or (select trial_ends_at from public.shops where id=sh)>now() then raise exception 'FAIL expired email regained access'; end if;
  if has_table_privilege('authenticated','private.trial_entitlements','SELECT') or has_table_privilege('anon','private.trial_entitlements','SELECT') or has_function_privilege('authenticated','private.trial_email_fingerprint(text)','EXECUTE') then raise exception 'FAIL trial history exposed'; end if;
end; $$;
