DO $$
DECLARE jid uuid:=gen_random_uuid(); payload jsonb; got uuid; denied boolean:=false;
BEGIN
 payload:=jsonb_build_object('email','qa.submit.'||jid||'@example.test','shopName','QA submit '||jid,'profile','{}'::jsonb,'services','[]'::jsonb,'staff','[]'::jsonb);
 got:=public.submit_assisted_setup(jid,payload);
 IF got<>jid OR public.submit_assisted_setup(jid,payload)<>jid THEN RAISE EXCEPTION 'Idempotency failed'; END IF;
 BEGIN PERFORM public.submit_assisted_setup(gen_random_uuid(),payload); EXCEPTION WHEN unique_violation THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Duplicate submission accepted'; END IF;
END $$;
DO $$
DECLARE jid uuid:=gen_random_uuid(); token text:='isolated-test'; claimed jsonb; denied boolean:=false;
BEGIN
 IF has_function_privilege('anon','public.submit_assisted_setup(uuid,jsonb)','EXECUTE') OR has_function_privilege('authenticated','public.submit_assisted_setup(uuid,jsonb)','EXECUTE') OR has_function_privilege('anon','public.claim_assisted_setup(uuid,text)','EXECUTE') THEN RAISE EXCEPTION 'Unrestricted integration';END IF;
 INSERT INTO private.assisted_jobs(id,email,shop_name,payload,token_hash,expires_at,trial_eligible) VALUES(jid,jid||'@example.test',jid::text,'{"test":true}',encode(extensions.digest(token,'sha256'),'hex'),now()+interval '1 minute',true);
 BEGIN PERFORM public.claim_assisted_setup(jid,'wrong');EXCEPTION WHEN OTHERS THEN denied:=true;END;
 IF NOT denied THEN RAISE EXCEPTION 'Wrong token accepted';END IF;
 claimed:=public.claim_assisted_setup(jid,token);
 IF claimed<>'{"test":true}'::jsonb THEN RAISE EXCEPTION 'Wrong payload';END IF;
 denied:=false;BEGIN PERFORM public.claim_assisted_setup(jid,token);EXCEPTION WHEN OTHERS THEN denied:=true;END;
 IF NOT denied THEN RAISE EXCEPTION 'Replay accepted';END IF;
 PERFORM public.finish_assisted_setup(jid,null,'{"test":true}',false);
 IF (SELECT count(*) FROM private.assisted_audit WHERE job_id=jid)<>2 THEN RAISE EXCEPTION 'Audit missing';END IF;
 UPDATE private.assisted_integration SET enabled=false;
 denied:=false;BEGIN PERFORM public.submit_assisted_setup(gen_random_uuid(),'{"email":"qa@example.test","shopName":"QA"}');EXCEPTION WHEN OTHERS THEN denied:=true;END;
 IF NOT denied THEN RAISE EXCEPTION 'Revoked integration accepted';END IF;
END $$;
DO $$
DECLARE uid uuid:=gen_random_uuid(); sid uuid; jid uuid:=gen_random_uuid(); draft uuid:=gen_random_uuid(); v_id uuid; start_date timestamptz;
BEGIN
 INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES(uid,'qa.assisted.'||uid||'@example.test','{"role":"barber","segment":"pet","shop_name":"QA assisted rollback"}');
 SELECT id INTO sid FROM public.shops WHERE owner_user_id=uid;
 INSERT INTO private.assisted_jobs(id,email,shop_name,payload,token_hash,expires_at,trial_eligible,status,shop_id) VALUES(jid,uid||'@example.test',uid::text,'{}','',now(),true,'complete',sid);
 INSERT INTO public.assisted_service_drafts(id,shop_id,name) VALUES(draft,sid,'Banho pendente');
 PERFORM set_config('request.jwt.claim.sub',uid::text,true);
 v_id:=public.confirm_assisted_service(draft,75,45);
 IF NOT EXISTS(SELECT 1 FROM public.services WHERE id=v_id AND price=75 AND duration_minutes=45) OR EXISTS(SELECT 1 FROM public.assisted_service_drafts WHERE id=draft) THEN RAISE EXCEPTION 'Draft confirmation failed';END IF;
 UPDATE auth.users SET last_sign_in_at=now() WHERE id=uid;
 SELECT trial_ends_at INTO start_date FROM public.shops WHERE id=sid;
 IF abs(extract(epoch from(start_date-now()-interval '30 days')))>2 OR NOT EXISTS(SELECT 1 FROM private.assisted_jobs WHERE id=jid AND activated_at IS NOT NULL) THEN RAISE EXCEPTION 'Activation trial failed';END IF;
 UPDATE auth.users SET last_sign_in_at=now()+interval '1 hour' WHERE id=uid;
 IF (SELECT trial_ends_at FROM public.shops WHERE id=sid)<>start_date THEN RAISE EXCEPTION 'Trial reset twice';END IF;
END $$;
-- Exercise RLS as actual authenticated roles, not only with the privileged SQL connection.
DO $$
DECLARE uid uuid:=gen_random_uuid(); sid uuid; draft uuid:=gen_random_uuid();
BEGIN
 INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES(uid,'qa.rls.'||uid||'@example.test','{"role":"barber","segment":"pet","shop_name":"QA RLS rollback"}');
 SELECT id INTO sid FROM public.shops WHERE owner_user_id=uid;
 INSERT INTO public.assisted_service_drafts(id,shop_id,name) VALUES(draft,sid,'Isolated service');
 INSERT INTO public.assisted_shop_setup(shop_id) VALUES(sid);
 PERFORM set_config('test.assisted_owner',uid::text,true);
 PERFORM set_config('test.assisted_shop',sid::text,true);
 PERFORM set_config('test.assisted_draft',draft::text,true);
 PERFORM set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
END $$;
SET LOCAL ROLE authenticated;
DO $$
DECLARE denied boolean:=false; did uuid:=current_setting('test.assisted_draft')::uuid; sid uuid:=current_setting('test.assisted_shop')::uuid;
BEGIN
 IF EXISTS(SELECT 1 FROM public.assisted_service_drafts WHERE id=did) OR EXISTS(SELECT 1 FROM public.assisted_shop_setup WHERE shop_id=sid) THEN RAISE EXCEPTION 'Cross-tenant read'; END IF;
 BEGIN PERFORM public.confirm_assisted_service(did,99,30); EXCEPTION WHEN OTHERS THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Cross-tenant confirmation'; END IF;
 PERFORM set_config('request.jwt.claim.sub',current_setting('test.assisted_owner'),true);
 IF NOT EXISTS(SELECT 1 FROM public.assisted_service_drafts WHERE id=did) THEN RAISE EXCEPTION 'Owner cannot read draft'; END IF;
 denied:=false;
 BEGIN PERFORM public.confirm_assisted_service(did,99,0); EXCEPTION WHEN OTHERS THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Invalid duration accepted'; END IF;
 PERFORM public.confirm_assisted_service(did,99,30);
 denied:=false;
 BEGIN PERFORM public.confirm_assisted_service(did,99,30); EXCEPTION WHEN OTHERS THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Duplicate confirmation accepted'; END IF;
END $$;
RESET ROLE;
