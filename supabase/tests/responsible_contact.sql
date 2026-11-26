-- Run only inside BEGIN/ROLLBACK; no persistent test accounts or real tenant writes.
DO $$ DECLARE u uuid:=gen_random_uuid(); old_u uuid:=gen_random_uuid(); assisted uuid:=gen_random_uuid(); sid uuid; s jsonb; rejected boolean; BEGIN
INSERT INTO auth.users(id,email,created_at,raw_user_meta_data) VALUES(u,u||'@example.test',now(),'{"role":"barber","segment":"pet"}'),(old_u,old_u||'@example.test',now()-interval '1 year','{"role":"barber","segment":"pet"}');
SELECT id INTO sid FROM public.shops WHERE owner_user_id=u;
PERFORM set_config('request.jwt.claim.sub',u::text,true);
s:=public.my_responsible_contact(); IF NOT (s->>'required')::boolean THEN RAISE EXCEPTION 'Missing contact not required';END IF;
rejected:=false;BEGIN PERFORM public.save_responsible_contact('20912345678'); EXCEPTION WHEN OTHERS THEN rejected:=true;END;IF NOT rejected THEN RAISE EXCEPTION 'Invalid DDD accepted';END IF;
PERFORM public.save_responsible_contact('(19) 91234-5678');
IF (public.my_responsible_contact()->>'required')::boolean OR (SELECT phone FROM private.responsible_contacts WHERE shop_id=sid)<>'5519912345678' THEN RAISE EXCEPTION 'Contact not persisted';END IF;
IF (SELECT phone FROM public.shops WHERE id=sid) IS NOT NULL THEN RAISE EXCEPTION 'Public phone overwritten';END IF;
rejected:=false;BEGIN PERFORM public.admin_responsible_contact(sid);EXCEPTION WHEN OTHERS THEN rejected:=true;END;IF NOT rejected THEN RAISE EXCEPTION 'Non admin access';END IF;
IF NOT public.claim_responsible_registration(sid) OR public.claim_responsible_registration(sid) THEN RAISE EXCEPTION 'Conversion duplicated';END IF;
PERFORM set_config('request.jwt.claim.sub',old_u::text,true);
IF (public.my_responsible_contact()->>'required')::boolean THEN RAISE EXCEPTION 'Old account blocked';END IF;
rejected:=false;BEGIN PERFORM public.save_responsible_contact('11912345678');EXCEPTION WHEN OTHERS THEN rejected:=true;END;IF NOT rejected THEN RAISE EXCEPTION 'Cross tenant update';END IF;
PERFORM set_config('request.jwt.claim.role','service_role',true);
INSERT INTO auth.users(id,email,created_at,raw_user_meta_data) VALUES(assisted,assisted||'@example.test',now(),'{"role":"barber","segment":"pet"}');
IF NOT EXISTS(SELECT 1 FROM private.responsible_contacts WHERE user_id=assisted AND phone IS NULL AND NOT new_registration) THEN RAISE EXCEPTION 'Assisted creation failed';END IF;
IF has_table_privilege('authenticated','private.responsible_contacts','SELECT') OR has_function_privilege('anon','public.admin_responsible_contact(uuid)','EXECUTE') THEN RAISE EXCEPTION 'Contact leaked';END IF;
END $$;
