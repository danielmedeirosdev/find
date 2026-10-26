-- A trial belongs to the first normalized email, and survives tenant/auth deletion.
-- Store a keyed fingerprint, never the raw email, outside the exposed API schema.
create table private.trial_fingerprint_key (
  singleton boolean primary key default true check (singleton),
  secret bytea not null
);
insert into private.trial_fingerprint_key(singleton,secret) values(true,extensions.gen_random_bytes(32));
create table private.trial_entitlements (
  email_fingerprint text primary key,
  first_started_at timestamptz not null,
  expires_at timestamptz not null
);
alter table private.trial_fingerprint_key enable row level security;
alter table private.trial_entitlements enable row level security;
revoke all on private.trial_fingerprint_key, private.trial_entitlements from public, anon, authenticated, service_role;

create function private.trial_email_fingerprint(p_email text)
returns text language sql stable set search_path='' as $$
  select encode(extensions.hmac(convert_to(lower(btrim(p_email)),'UTF8'), k.secret, 'sha256'),'hex')
  from private.trial_fingerprint_key k where singleton;
$$;
revoke all on function private.trial_email_fingerprint(text) from public,anon,authenticated,service_role;

-- Preserve current accounts' deadlines. This does not update any shop or billing row.
insert into private.trial_entitlements(email_fingerprint,first_started_at,expires_at)
select private.trial_email_fingerprint(u.email),min(s.created_at),min(coalesce(s.trial_ends_at,s.created_at+interval '30 days'))
from public.shops s join auth.users u on u.id=s.owner_user_id
where nullif(btrim(u.email),'') is not null
group by private.trial_email_fingerprint(u.email);

create function private.apply_first_shop_trial()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_email text; v_fingerprint text; v_expires timestamptz;
begin
  -- Identity comes from auth.users, not editable metadata or a browser deadline.
  select email into v_email from auth.users where id=new.owner_user_id;
  if nullif(btrim(v_email),'') is null then raise exception 'É necessário um e-mail válido para cadastrar o estabelecimento.'; end if;
  v_fingerprint:=private.trial_email_fingerprint(v_email);
  -- The unique key serializes simultaneous creations for the same email.
  insert into private.trial_entitlements(email_fingerprint,first_started_at,expires_at)
  values(v_fingerprint,now(),now()+interval '30 days')
  on conflict(email_fingerprint) do update set email_fingerprint=excluded.email_fingerprint
  returning expires_at into v_expires;
  if new.subscription_status='trial' or coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role','') in ('authenticated','anon') then
    new.trial_ends_at:=v_expires;
    new.subscription_status:=case when v_expires<=now() then 'blocked' else 'trial' end;
  end if;
  return new;
end;
$$;
revoke all on function private.apply_first_shop_trial() from public,anon,authenticated,service_role;
create trigger shops_apply_first_trial before insert on public.shops
for each row execute function private.apply_first_shop_trial();

-- Changing an email cannot detach an account from its original deadline.
-- Keep both fingerprints so either address reuses the earliest existing deadline.
create function private.preserve_trial_on_email_change()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_first timestamptz; v_expires timestamptz;
begin
  if nullif(btrim(new.email),'') is null then return new; end if;
  select first_started_at,expires_at into v_first,v_expires from private.trial_entitlements
    where email_fingerprint=private.trial_email_fingerprint(old.email);
  if v_expires is not null then
    insert into private.trial_entitlements(email_fingerprint,first_started_at,expires_at)
    values(private.trial_email_fingerprint(new.email),v_first,v_expires)
    on conflict(email_fingerprint) do update set
      first_started_at=least(private.trial_entitlements.first_started_at,excluded.first_started_at),
      expires_at=least(private.trial_entitlements.expires_at,excluded.expires_at);
  end if;
  return new;
end;
$$;
revoke all on function private.preserve_trial_on_email_change() from public,anon,authenticated,service_role;
create trigger auth_preserve_trial_email after update of email on auth.users
for each row when (old.email is distinct from new.email) execute function private.preserve_trial_on_email_change();
