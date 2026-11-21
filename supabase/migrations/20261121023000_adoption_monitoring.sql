-- Append-only, minimal server audit. Never backfill actors or sessions.
CREATE TABLE private.adoption_settings(singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),started_at timestamptz NOT NULL DEFAULT now());
INSERT INTO private.adoption_settings DEFAULT VALUES;
CREATE TABLE private.adoption_sessions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),shop_id uuid NOT NULL,user_id uuid NOT NULL,actor_role text NOT NULL,started_at timestamptz NOT NULL DEFAULT now(),last_seen_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX adoption_sessions_scope ON private.adoption_sessions(shop_id,user_id,last_seen_at DESC);
CREATE TABLE private.adoption_features(session_id uuid REFERENCES private.adoption_sessions(id),feature text NOT NULL,last_seen_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(session_id,feature));
CREATE TABLE private.adoption_presence_days(session_id uuid REFERENCES private.adoption_sessions(id),day_key date NOT NULL,last_seen_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(session_id,day_key));
ALTER TABLE private.adoption_presence_days ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.adoption_presence_days FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE private.adoption_events(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,shop_id uuid NOT NULL,actor_id uuid,actor_role text NOT NULL,occurred_at timestamptz NOT NULL DEFAULT now(),entity_kind text NOT NULL,entity_id uuid NOT NULL,action text NOT NULL,assigned_professional_id uuid,booking_date date,historical_entry boolean,previous_status text,new_status text);
CREATE INDEX adoption_events_scope ON private.adoption_events(shop_id,occurred_at,actor_id);
ALTER TABLE private.adoption_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.adoption_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.adoption_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.adoption_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.adoption_settings,private.adoption_sessions,private.adoption_features,private.adoption_events FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION private.adoption_role(p_shop uuid,p_actor uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT CASE WHEN p_actor IS NULL THEN 'unattributed' WHEN EXISTS(SELECT 1 FROM public.shops WHERE id=p_shop AND owner_user_id=p_actor) THEN 'owner' WHEN EXISTS(SELECT 1 FROM public.barbers WHERE shop_id=p_shop AND user_id=p_actor) THEN 'staff' WHEN EXISTS(SELECT 1 FROM auth.users WHERE id=p_actor AND raw_app_meta_data->>'onefind_platform_admin'='true') THEN 'admin' ELSE 'external' END;
$$;
REVOKE ALL ON FUNCTION private.adoption_role(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION private.audit_adoption_write() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE row_data jsonb; old_data jsonb; sid uuid; uid uuid:=auth.uid(); operation text; relevant text[];
BEGIN
 row_data:=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
 old_data:=CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE '{}'::jsonb END;
 sid:=(row_data->>'shop_id')::uuid;
 IF TG_TABLE_NAME='package_usages' THEN SELECT shop_id INTO sid FROM public.customer_packages WHERE id=(row_data->>'customer_package_id')::uuid;END IF;
 IF sid IS NULL THEN RETURN NULL; END IF;
 IF TG_OP='UPDATE' THEN
 relevant:=CASE TG_TABLE_NAME WHEN 'bookings' THEN ARRAY['client_name','client_phone','services_amount','pet_transport','pet_transport_charge_mode','pet_transport_round_trip','date','time','barber_id','status','duration_minutes','archived_at','shop_customer_id','pet_id','notes','quoted_amount','amount_due','customer_package_id','discount_amount','extras_amount','pet_transport_fee'] WHEN 'financial_transactions' THEN ARRAY['amount','type','payment_method','paid_on','booking_id','customer_package_id','description'] WHEN 'package_usages' THEN ARRAY['reversed_at','booking_id','note'] WHEN 'service_packages' THEN ARRAY['name','description','price','total_sessions','validity_days','active'] WHEN 'customer_packages' THEN ARRAY['total_sessions','used_sessions','status','sale_amount','expires_at'] ELSE ARRAY['name','phone','email','size','breed','notes','customer_id'] END;
 IF NOT EXISTS(SELECT 1 FROM unnest(relevant) k WHERE row_data->k IS DISTINCT FROM old_data->k) THEN RETURN NULL; END IF;
 END IF;
 operation:=CASE TG_OP WHEN 'INSERT' THEN 'created' WHEN 'DELETE' THEN 'deleted' ELSE 'edited' END;
 IF TG_TABLE_NAME='bookings' AND TG_OP='UPDATE' AND row_data->>'status' IS DISTINCT FROM old_data->>'status' THEN operation:=CASE row_data->>'status' WHEN 'completed' THEN 'completed' WHEN 'cancelled' THEN 'cancelled' ELSE 'status_changed' END;END IF;
 INSERT INTO private.adoption_events(shop_id,actor_id,actor_role,entity_kind,entity_id,action,assigned_professional_id,booking_date,historical_entry,previous_status,new_status)
 VALUES(sid,uid,private.adoption_role(sid,uid),TG_TABLE_NAME,(row_data->>'id')::uuid,operation,CASE WHEN TG_TABLE_NAME='bookings' THEN (row_data->>'barber_id')::uuid END,CASE WHEN TG_TABLE_NAME='bookings' THEN (row_data->>'date')::date END,CASE WHEN TG_TABLE_NAME='bookings' THEN (row_data->>'historical_entry')::boolean END,old_data->>'status',row_data->>'status');
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION private.audit_adoption_write() FROM PUBLIC,anon,authenticated,service_role;
DO $$ DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['bookings','shop_customers','pets','service_packages','customer_packages','package_usages','financial_transactions'] LOOP
 EXECUTE format('CREATE TRIGGER adoption_write AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION private.audit_adoption_write()',t);
END LOOP;END $$;
CREATE FUNCTION public.record_operational_presence(p_shop_id uuid,p_feature text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE uid uuid:=auth.uid(); sid uuid:=p_shop_id; role_name text; visit uuid;
BEGIN
 IF uid IS NULL OR p_feature IS NULL OR p_feature NOT IN('overview','agenda','customers','pets','services','packages','cashflow','reports','team','info','subscription','other') THEN RAISE EXCEPTION 'Presença inválida'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.shops WHERE id=sid AND owner_user_id=uid) AND NOT EXISTS(SELECT 1 FROM public.barbers WHERE shop_id=sid AND user_id=uid) THEN RETURN; END IF;
 role_name:=private.adoption_role(sid,uid);
 PERFORM pg_advisory_xact_lock(hashtextextended(sid::text||uid::text,0));
 SELECT id INTO visit FROM private.adoption_sessions WHERE shop_id=sid AND user_id=uid AND last_seen_at>now()-interval '30 minutes' ORDER BY last_seen_at DESC LIMIT 1;
 IF visit IS NULL THEN INSERT INTO private.adoption_sessions(shop_id,user_id,actor_role) VALUES(sid,uid,role_name) RETURNING id INTO visit;ELSE UPDATE private.adoption_sessions SET last_seen_at=now() WHERE id=visit;END IF;
 INSERT INTO private.adoption_presence_days(session_id,day_key) VALUES(visit,(now() AT TIME ZONE 'America/Sao_Paulo')::date) ON CONFLICT(session_id,day_key) DO UPDATE SET last_seen_at=now();
 INSERT INTO private.adoption_features(session_id,feature) VALUES(visit,p_feature) ON CONFLICT(session_id,feature) DO UPDATE SET last_seen_at=now();
END $$;
REVOKE ALL ON FUNCTION public.record_operational_presence(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.record_operational_presence(uuid,text) TO authenticated;
CREATE FUNCTION public.admin_shop_adoption(p_shop_id uuid,p_from date,p_to date,p_asof date,p_offset integer DEFAULT 0,p_booking_day date DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb; from_ts timestamptz; to_ts timestamptz;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=auth.uid() AND raw_app_meta_data->>'onefind_platform_admin'='true') THEN RAISE EXCEPTION 'Acesso administrativo necessário';END IF;
 IF p_from IS NULL OR p_to IS NULL OR p_asof IS NULL OR p_to<p_from OR p_to-p_from>366 OR p_offset<0 OR p_offset>1000000 THEN RAISE EXCEPTION 'Período inválido';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.shops WHERE id=p_shop_id) THEN RAISE EXCEPTION 'Estabelecimento não encontrado';END IF;
 from_ts:=p_from::timestamp AT TIME ZONE 'America/Sao_Paulo';to_ts:=(p_to+1)::timestamp AT TIME ZONE 'America/Sao_Paulo';
 WITH memberships AS (
 SELECT owner_user_id id,'owner' role,'Proprietário' name FROM public.shops WHERE id=p_shop_id
 UNION SELECT user_id,'staff',name FROM public.barbers WHERE shop_id=p_shop_id AND user_id IS NOT NULL AND user_id<>(SELECT owner_user_id FROM public.shops WHERE id=p_shop_id)
 ), users AS (SELECT DISTINCT ON(id) * FROM memberships ORDER BY id,CASE role WHEN 'owner' THEN 0 ELSE 1 END,name), historic AS (
 SELECT created_at ts,'bookings' kind FROM public.bookings WHERE shop_id=p_shop_id
 UNION ALL SELECT created_at,'customers' FROM public.shop_customers WHERE shop_id=p_shop_id
 UNION ALL SELECT created_at,'pets' FROM public.pets WHERE shop_id=p_shop_id
 UNION ALL SELECT created_at,'packages' FROM public.customer_packages WHERE shop_id=p_shop_id
 UNION ALL SELECT created_at,'finance' FROM public.financial_transactions WHERE shop_id=p_shop_id
 ), daily AS (
 SELECT d::date AS day_key FROM generate_series(p_from::timestamp,p_to::timestamp,interval '1 day') d
 )
 SELECT jsonb_build_object(
 'started_at',(SELECT started_at FROM private.adoption_settings),'generated_at',now(),'asof',p_asof,
 'summary',(SELECT jsonb_build_object('total',count(*),'archived',count(*) FILTER(WHERE archived_at IS NOT NULL),'future',count(*) FILTER(WHERE date>=p_asof),'future_open',count(*) FILTER(WHERE date>=p_asof AND archived_at IS NULL AND status IN('scheduled','confirmed','in_progress')),'past_scheduled',count(*) FILTER(WHERE date<p_asof AND status='scheduled'),'past_open',count(*) FILTER(WHERE date<p_asof AND archived_at IS NULL AND status IN('scheduled','confirmed','in_progress')),'historical',count(*) FILTER(WHERE historical_entry),'last_created',max(created_at)) FROM public.bookings WHERE shop_id=p_shop_id),
 'actors',coalesce((SELECT jsonb_agg(jsonb_build_object('id',u.id,'role',u.role,'name',u.name,'last_authentication',a.last_sign_in_at,
 'last_presence',(SELECT max(last_seen_at) FROM private.adoption_sessions WHERE shop_id=p_shop_id AND user_id=u.id),
 'last_action',(SELECT max(occurred_at) FROM private.adoption_events WHERE shop_id=p_shop_id AND actor_id=u.id),
 'sessions',(SELECT count(*) FROM private.adoption_sessions WHERE shop_id=p_shop_id AND user_id=u.id AND started_at>=from_ts AND started_at<to_ts),
 'active_days',(SELECT count(DISTINCT (occurred_at AT TIME ZONE 'America/Sao_Paulo')::date) FROM private.adoption_events WHERE shop_id=p_shop_id AND actor_id=u.id AND occurred_at>=from_ts AND occurred_at<to_ts),
 'return_days',(SELECT count(DISTINCT d.day_key) FROM private.adoption_presence_days d JOIN private.adoption_sessions s ON s.id=d.session_id WHERE s.shop_id=p_shop_id AND s.user_id=u.id AND d.day_key BETWEEN p_from AND p_to))) FROM users u JOIN auth.users a ON a.id=u.id),'[]'::jsonb),
 'daily',coalesce((SELECT jsonb_agg(jsonb_build_object('day',day_key,
 'historical',(SELECT jsonb_build_object('bookings',count(*) FILTER(WHERE kind='bookings'),'customers',count(*) FILTER(WHERE kind='customers'),'pets',count(*) FILTER(WHERE kind='pets'),'packages',count(*) FILTER(WHERE kind='packages'),'finance',count(*) FILTER(WHERE kind='finance')) FROM historic h WHERE (h.ts AT TIME ZONE 'America/Sao_Paulo')::date=day_key),
 'actions',coalesce((SELECT jsonb_agg(x) FROM (SELECT actor_id,actor_role,entity_kind,action,count(*) count FROM private.adoption_events WHERE shop_id=p_shop_id AND (occurred_at AT TIME ZONE 'America/Sao_Paulo')::date=day_key GROUP BY 1,2,3,4) x),'[]'::jsonb)
 ) ORDER BY day_key) FROM daily),'[]'::jsonb),
 'features',coalesce((SELECT jsonb_agg(x) FROM (SELECT s.user_id,f.feature,count(DISTINCT s.id) sessions FROM private.adoption_features f JOIN private.adoption_sessions s ON s.id=f.session_id WHERE s.shop_id=p_shop_id AND f.last_seen_at>=from_ts AND f.last_seen_at<to_ts GROUP BY 1,2) x),'[]'::jsonb),
 'calendar',coalesce((SELECT jsonb_agg(x) FROM (SELECT date,count(*) total,count(*) FILTER(WHERE archived_at IS NULL AND status IN('scheduled','confirmed','in_progress')) open FROM public.bookings WHERE shop_id=p_shop_id AND date>=p_asof GROUP BY date ORDER BY date) x),'[]'::jsonb),
 'assignments',coalesce((SELECT jsonb_agg(x) FROM (SELECT b.barber_id,p.name,count(*) total FROM public.bookings b LEFT JOIN public.barbers p ON p.id=b.barber_id WHERE b.shop_id=p_shop_id GROUP BY b.barber_id,p.name) x),'[]'::jsonb),
 'booking_rows',(SELECT count(*) FROM public.bookings WHERE shop_id=p_shop_id AND (p_booking_day IS NULL OR date=p_booking_day)),
 'bookings',coalesce((SELECT jsonb_agg(x) FROM (SELECT b.id,b.created_at,b.date,b.time,b.status,b.historical_entry,b.archived_at,p.name professional,(b.date-(b.created_at AT TIME ZONE 'America/Sao_Paulo')::date) lead_days,
 (SELECT actor_role FROM private.adoption_events e WHERE e.entity_kind='bookings' AND e.entity_id=b.id AND e.action='created' ORDER BY e.id LIMIT 1) creator_role,
 (SELECT actor_id FROM private.adoption_events e WHERE e.entity_kind='bookings' AND e.entity_id=b.id AND e.action='created' ORDER BY e.id LIMIT 1) creator_id
 FROM public.bookings b LEFT JOIN public.barbers p ON p.id=b.barber_id WHERE b.shop_id=p_shop_id AND (p_booking_day IS NULL OR b.date=p_booking_day) ORDER BY b.created_at DESC,b.id LIMIT 100 OFFSET p_offset) x),'[]'::jsonb)
 ) INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.admin_shop_adoption(uuid,date,date,date,integer,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_shop_adoption(uuid,date,date,date,integer,date) TO authenticated;
