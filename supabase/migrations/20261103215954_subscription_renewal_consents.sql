-- Stores consent and provider operation outcomes only. Never card numbers, CVV or tokens.
create table public.subscription_renewal_consents (
  id uuid primary key,
  shop_id uuid not null references public.shops(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  action text not null check (action in ('enable_card','use_pix')),
  subscription_id text not null,
  amount_cents integer not null default 6000 check (amount_cents = 6000),
  next_due_date date,
  outcome text not null default 'requested' check (outcome in ('requested','confirmed','unknown')),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);
alter table public.subscription_renewal_consents enable row level security;
revoke all on public.subscription_renewal_consents from anon, authenticated;
grant select on public.subscription_renewal_consents to authenticated;
grant all on public.subscription_renewal_consents to service_role;
create policy subscription_renewal_owner_read on public.subscription_renewal_consents
  for select to authenticated using (
    exists (select 1 from public.shops s where s.id = shop_id and s.owner_user_id = (select auth.uid()))
  );
create index subscription_renewal_consents_shop_idx on public.subscription_renewal_consents(shop_id, created_at desc);
