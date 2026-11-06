create table if not exists public.shop_marketing_attribution (
  shop_id uuid primary key references public.shops(id) on delete cascade,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  fbclid text,
  landing_path text not null,
  first_seen_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint shop_marketing_attribution_source_length check (char_length(utm_source) <= 500),
  constraint shop_marketing_attribution_medium_length check (char_length(utm_medium) <= 500),
  constraint shop_marketing_attribution_campaign_length check (char_length(utm_campaign) <= 500),
  constraint shop_marketing_attribution_content_length check (char_length(utm_content) <= 500),
  constraint shop_marketing_attribution_term_length check (char_length(utm_term) <= 500),
  constraint shop_marketing_attribution_fbclid_length check (char_length(fbclid) <= 700),
  constraint shop_marketing_attribution_landing_length check (char_length(landing_path) <= 500)
);

alter table public.shop_marketing_attribution enable row level security;

create policy "Owners can insert their shop attribution"
on public.shop_marketing_attribution
for insert
to authenticated
with check (
  exists (
    select 1
    from public.shops
    where shops.id = shop_marketing_attribution.shop_id
      and shops.owner_user_id = (select auth.uid())
  )
);

create policy "Owners can read their shop attribution"
on public.shop_marketing_attribution
for select
to authenticated
using (
  exists (
    select 1
    from public.shops
    where shops.id = shop_marketing_attribution.shop_id
      and shops.owner_user_id = (select auth.uid())
  )
);

comment on table public.shop_marketing_attribution is
  'Immutable first-touch attribution for a newly created Onefind establishment.';
