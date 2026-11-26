-- Always run inside BEGIN/ROLLBACK, with the migration if it is not installed.
DO $$ DECLARE fresh uuid:=gen_random_uuid(); old_id uuid:=gen_random_uuid(); invited uuid:=gen_random_uuid(); sid uuid;BEGIN
 INSERT INTO auth.users(id,email,created_at,raw_user_meta_data) VALUES(fresh,fresh||'@example.test',now(),'{"role":"barber","segment":"pet"}'),(old_id,old_id||'@example.test',now()-interval '1 year','{"role":"barber","segment":"pet"}');
 SELECT id INTO sid FROM public.shops WHERE owner_user_id=fresh;
 IF NOT EXISTS(SELECT 1 FROM public.initial_setup WHERE shop_id=sid AND mode IS NULL AND step=1) THEN RAISE EXCEPTION 'Choice missing for new owner';END IF;
 IF EXISTS(SELECT 1 FROM public.initial_setup s JOIN public.shops sh ON sh.id=s.shop_id WHERE sh.owner_user_id=old_id) THEN RAISE EXCEPTION 'Existing user incorrectly enrolled';END IF;
 PERFORM set_config('request.jwt.claim.role','service_role',true);
 INSERT INTO auth.users(id,email,created_at,raw_user_meta_data) VALUES(invited,invited||'@example.test',now(),'{"role":"barber","segment":"pet"}');
 IF EXISTS(SELECT 1 FROM public.initial_setup s JOIN public.shops sh ON sh.id=s.shop_id WHERE sh.owner_user_id=invited) THEN RAISE EXCEPTION 'Admin invitation incorrectly enrolled';END IF;
 UPDATE public.initial_setup SET mode='self',step=4,status='deferred',skipped=ARRAY[3] WHERE shop_id=sid;
 IF NOT EXISTS(SELECT 1 FROM public.initial_setup WHERE shop_id=sid AND step=4 AND skipped=ARRAY[3] AND status='deferred') THEN RAISE EXCEPTION 'Progress not persistent';END IF;
 PERFORM set_config('request.jwt.claim.sub',old_id::text,true);
END $$;
SET LOCAL ROLE authenticated;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM public.initial_setup) THEN RAISE EXCEPTION 'Cross tenant read';END IF;END $$;
RESET ROLE;
