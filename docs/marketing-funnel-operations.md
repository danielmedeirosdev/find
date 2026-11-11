# Marketing funnel diagnostics

`marketing_funnel_events` stores only public marketing/authentication steps,
allowlisted failure stages, an anonymous tab session, and first/last campaign
identifiers. No raw error messages, credentials, contact details or URL query
strings enter this table. Browser telemetry is untrusted: reconcile actual
acquisitions with `shops` and actual usage with bookings.

Start a technical browser session with `?onefind_test=1`. This persists for the
tab session, marks diagnostics `is_test=true`, and suppresses GA4/Meta events.
Known technical accounts can be tagged with `app_metadata.onefind_analytics_test`
by an administrator; this flag has no authentication/authorization role.

Check failures and their conversion campaign:

```sql
select date_trunc('hour', created_at) as hour,
       stage, method, source, first_utm_campaign, last_utm_campaign,
       count(*) as events, count(distinct session_id) as sessions
from public.marketing_funnel_events
where event_name = 'signup_error' and not is_test
  and created_at >= now() - interval '7 days'
group by 1,2,3,4,5,6
order by 1 desc;
```

Inspect technical test receipts separately:

```sql
select event_name, stage, method, last_utm_campaign, count(*)
from public.marketing_funnel_events
where is_test and created_at >= now() - interval '1 day'
group by 1,2,3,4;
```

WhatsApp campaign 04D uses a distinct campaign identifier and a prefilled
message: “Tenho um banho e tosa e quero conhecer o onefind.” Campaign
identifiers stay in URL tags, outside the customer-facing message. For assisted signup, share the normal
business signup link with `utm_source=whatsapp`,
`utm_campaign=onefind_teste04d_whatsapp`, and
`utm_content=beneficios_fbfeed_igstories`. Do not add the technical test flag
to a real prospect's link.

The first touch remains immutable; the last sourced touch is persisted in
`shop_marketing_attribution` when the shop is created. Historical 04/04B
UTMs cannot be separated retrospectively where both used the same value.

Release 04D only after validating the real mobile WhatsApp handoff.
The lifetime budget is R$25, not a daily budget. Count qualified conversations,
created shops and first bookings; never treat all clicks as qualified leads.
