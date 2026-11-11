create table public.marketing_funnel_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  event_name text not null check (event_name in (
    'page_view', 'landing_cta', 'signup_view', 'signup_submit', 'signup_start',
    'signup_error', 'registration_complete', 'setup_choice', 'setup_whatsapp_open',
    'setup_manual_start', 'setup_complete'
  )),
  method text check (method in ('email', 'google')),
  stage text check (stage in ('google_load', 'google_auth', 'password_requirements',
    'auth_signup', 'missing_user', 'session_confirmation', 'shop_creation', 'unexpected')),
  source text check (source in ('hero', 'landing', 'login_toggle', 'header', 'footer',
    'pricing', 'menu', 'nav', 'final', 'features', 'cta', 'mobile')),
  page_path text not null check (page_path in ('/', '/pet', '/apresentacao', '/painel', '/auth/callback')),
  first_utm_source text check (first_utm_source ~ '^[a-zA-Z0-9_-]{1,160}$'),
  first_utm_campaign text check (first_utm_campaign ~ '^[a-zA-Z0-9_-]{1,160}$'),
  first_utm_content text check (first_utm_content ~ '^[a-zA-Z0-9_-]{1,160}$'),
  last_utm_source text check (last_utm_source ~ '^[a-zA-Z0-9_-]{1,160}$'),
  last_utm_campaign text check (last_utm_campaign ~ '^[a-zA-Z0-9_-]{1,160}$'),
  last_utm_content text check (last_utm_content ~ '^[a-zA-Z0-9_-]{1,160}$'),
  shop_id uuid references public.shops(id) on delete set null,
  is_test boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.marketing_funnel_events enable row level security;
revoke all on public.marketing_funnel_events from public, anon, authenticated;
grant insert (session_id, event_name, method, stage, source, page_path,
  first_utm_source, first_utm_campaign, first_utm_content,
  last_utm_source, last_utm_campaign, last_utm_content, shop_id, is_test)
on public.marketing_funnel_events to anon, authenticated;
grant select on public.marketing_funnel_events to authenticated;
grant all on public.marketing_funnel_events to service_role;

create policy "Visitors can submit anonymous funnel diagnostics"
on public.marketing_funnel_events for insert to anon
with check (shop_id is null);

create policy "Signed-in users can submit their funnel diagnostics"
on public.marketing_funnel_events for insert to authenticated
with check (
  shop_id is null or (
    (select auth.uid()) is not null and exists (
      select 1 from public.shops s
      where s.id = marketing_funnel_events.shop_id
        and s.owner_user_id = (select auth.uid())
    )
  )
);

create policy "Platform admins can inspect funnel diagnostics"
on public.marketing_funnel_events for select to authenticated
using (((select auth.jwt())->'app_metadata'->>'onefind_platform_admin') = 'true');

create index marketing_funnel_events_created_at_idx on public.marketing_funnel_events(created_at);
create index marketing_funnel_events_session_idx on public.marketing_funnel_events(session_id);
create index marketing_funnel_events_shop_idx on public.marketing_funnel_events(shop_id) where shop_id is not null;

alter table public.shop_marketing_attribution
  add column last_utm_source text check (char_length(last_utm_source) <= 500),
  add column last_utm_campaign text check (char_length(last_utm_campaign) <= 500),
  add column last_utm_content text check (char_length(last_utm_content) <= 500),
  add column last_seen_at timestamptz,
  add column is_test boolean not null default false;

comment on table public.marketing_funnel_events is
  'Untrusted browser telemetry: allowlisted steps and campaign identifiers, no credentials or contact data. Corroborate acquisitions against shops; exclude is_test.';

-- Label the already-identified technical account without embedding generated IDs.
update auth.users u set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
  || '{"onefind_analytics_test":true}'::jsonb
where exists (select 1 from public.shops s where s.owner_user_id = u.id and s.name = 'Teste técnico onefind');

update public.shop_marketing_attribution a set is_test = true
where exists (select 1 from public.shops s where s.id = a.shop_id and s.name = 'Teste técnico onefind');
