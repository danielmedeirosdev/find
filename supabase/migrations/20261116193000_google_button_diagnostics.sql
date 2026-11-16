-- Extend existing allowlists without rewriting historical telemetry or changing access.
DO $$
DECLARE definition text;
BEGIN
 SELECT pg_get_constraintdef(oid) INTO definition FROM pg_constraint WHERE conrelid='public.marketing_funnel_events'::regclass AND conname='marketing_funnel_events_event_name_check';
 definition:=replace(definition,'''signup_error''::text','''signup_error''::text, ''google_button_error''::text');
 ALTER TABLE public.marketing_funnel_events DROP CONSTRAINT marketing_funnel_events_event_name_check;
 EXECUTE 'ALTER TABLE public.marketing_funnel_events ADD CONSTRAINT marketing_funnel_events_event_name_check '||definition;
 SELECT pg_get_constraintdef(oid) INTO definition FROM pg_constraint WHERE conrelid='public.marketing_funnel_events'::regclass AND conname='marketing_funnel_events_stage_check';
 definition:=replace(definition,'''google_load''::text','''google_load''::text, ''google_script_error''::text, ''google_script_timeout''::text, ''google_sdk_missing''::text, ''google_prepare''::text');
 ALTER TABLE public.marketing_funnel_events DROP CONSTRAINT marketing_funnel_events_stage_check;
 EXECUTE 'ALTER TABLE public.marketing_funnel_events ADD CONSTRAINT marketing_funnel_events_stage_check '||definition;
END $$;
