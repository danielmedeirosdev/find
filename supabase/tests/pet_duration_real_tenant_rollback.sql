-- Run after BEGIN and the duration migration in the SAME session.
-- Uses existing tenants and values only. Always ROLLBACK; never commit this test.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '20s';
CREATE TEMP TABLE duration_test_context AS
SELECT s.shop_id, s.id as service_id, sh.owner_user_id, s.duration_minutes,
 (SELECT jsonb_object_agg(r.size,r.duration_minutes) FROM public.service_size_rules r WHERE r.service_id=s.id) AS sizes,
 (SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id) FROM public.service_size_rules r WHERE r.service_id=s.id) AS original_rules,
 (SELECT other.owner_user_id FROM public.shops other WHERE other.owner_user_id <> sh.owner_user_id LIMIT 1) as other_owner
FROM public.services s JOIN public.shops sh ON sh.id=s.shop_id
WHERE sh.segment='pet' AND sh.owner_user_id IS NOT NULL
 AND (SELECT count(*) FROM public.service_size_rules r WHERE r.service_id=s.id AND r.duration_minutes BETWEEN 15 AND 720)=3
LIMIT 1;
GRANT SELECT ON duration_test_context TO authenticated;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM duration_test_context WHERE other_owner IS NOT NULL) THEN RAISE EXCEPTION 'Insufficient existing tenants for test'; END IF; END $$;
SELECT set_config('request.jwt.claim.sub',owner_user_id::text,true) FROM duration_test_context;
SET LOCAL ROLE authenticated;
DO $$ DECLARE t record; result uuid; BEGIN
 SELECT * INTO t FROM duration_test_context;
 result := public.save_pet_service_duration(t.shop_id,t.service_id,NULL,NULL,t.duration_minutes,t.sizes);
 IF result <> t.service_id THEN RAISE EXCEPTION 'Owner save failed'; END IF;
 IF (SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id) FROM public.service_size_rules r WHERE r.service_id=t.service_id) IS DISTINCT FROM t.original_rules THEN RAISE EXCEPTION 'Existing values changed'; END IF;
 PERFORM public.save_pet_service_duration(t.shop_id,t.service_id,NULL,NULL,t.duration_minutes,NULL);
 IF EXISTS(SELECT 1 FROM public.service_size_rules WHERE service_id=t.service_id AND duration_minutes<>t.duration_minutes) THEN RAISE EXCEPTION 'Single duration failed'; END IF;
 PERFORM public.save_pet_service_duration(t.shop_id,t.service_id,NULL,NULL,t.duration_minutes,t.sizes);
 IF (SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id) FROM public.service_size_rules r WHERE r.service_id=t.service_id) IS DISTINCT FROM t.original_rules THEN RAISE EXCEPTION 'Size restoration or price preservation failed'; END IF;
 BEGIN
  PERFORM public.save_pet_service_duration(t.shop_id,t.service_id,NULL,NULL,t.duration_minutes,'{}');
  RAISE EXCEPTION 'Invalid input accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM='Invalid input accepted' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',other_owner::text,true) FROM duration_test_context;
SET LOCAL ROLE authenticated;
DO $$ DECLARE t record; affected integer; BEGIN
 SELECT * INTO t FROM duration_test_context;
 BEGIN
  PERFORM public.save_pet_service_duration(t.shop_id,t.service_id,NULL,NULL,t.duration_minutes,t.sizes);
  RAISE EXCEPTION 'Cross tenant RPC permitted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM='Cross tenant RPC permitted' THEN RAISE; END IF; END;
 UPDATE public.service_size_rules SET duration_minutes=duration_minutes WHERE service_id=t.service_id;
 GET DIAGNOSTICS affected=ROW_COUNT;
 IF affected<>0 THEN RAISE EXCEPTION 'Cross tenant direct update permitted'; END IF;
 UPDATE public.services SET duration_minutes=duration_minutes WHERE id=t.service_id;
 GET DIAGNOSTICS affected=ROW_COUNT;
 IF affected<>0 THEN RAISE EXCEPTION 'Cross tenant service update permitted'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF has_function_privilege('anon','public.save_pet_service_duration(uuid,uuid,text,numeric,integer,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'Anonymous RPC permitted'; END IF;
END $$;
ROLLBACK;
SELECT 'PASS: owner save, single/size transitions, preserved prices, invalid input, cross-tenant RPC and direct writes, anonymous deny; rolled back' AS result;
