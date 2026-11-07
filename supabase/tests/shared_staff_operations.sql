-- Always execute in BEGIN / ROLLBACK. Only isolated generated accounts are used.
DO $$
DECLARE v_owner uuid:=gen_random_uuid(); v_staff uuid:=gen_random_uuid(); v_other_owner uuid:=gen_random_uuid(); v_shop uuid; v_other uuid;
v_barber uuid:=gen_random_uuid(); v_peer uuid:=gen_random_uuid(); v_customer uuid:=gen_random_uuid(); v_pet uuid:=gen_random_uuid(); v_service uuid:=gen_random_uuid(); v_template uuid:=gen_random_uuid(); v_package uuid:=gen_random_uuid(); v_booking uuid; v_denied boolean; v_count int;
BEGIN
 INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
 (v_owner,'qa.ops.'||v_owner||'@example.com','{"role":"barber","segment":"pet","shop_name":"QA ops"}'),
 (v_staff,'qa.ops.'||v_staff||'@example.com','{"role":"barber","segment":"pet","shop_name":"QA staff"}'),
 (v_other_owner,'qa.ops.'||v_other_owner||'@example.com','{"role":"barber","segment":"pet","shop_name":"QA other"}');
 SELECT id INTO v_shop FROM public.shops WHERE owner_user_id=v_owner;
 SELECT id INTO v_other FROM public.shops WHERE owner_user_id=v_other_owner;
 PERFORM set_config('request.jwt.claim.role','service_role',true);
 INSERT INTO public.barbers(id,shop_id,name,user_id) VALUES(v_barber,v_shop,'QA staff',v_staff),(v_peer,v_shop,'QA peer',null);
 INSERT INTO public.barber_schedule(barber_id,day_of_week,is_active,start_time,end_time)
 SELECT v_peer,day,true,'09:00','18:00' FROM generate_series(0,6) day;
 INSERT INTO public.shop_customers(id,shop_id,name,phone) VALUES(v_customer,v_shop,'QA','19999990000');
 INSERT INTO public.pets(id,shop_id,customer_id,name) VALUES(v_pet,v_shop,v_customer,'QA');
 INSERT INTO public.services(id,shop_id,name,price,duration_minutes) VALUES(v_service,v_shop,'QA',50,60);
 INSERT INTO public.service_packages(id,shop_id,name,total_sessions,price) VALUES(v_template,v_shop,'QA',2,100);
 INSERT INTO public.financial_transactions(shop_id,type,description,amount,payment_method) VALUES(v_shop,'entrada','QA secret',999,'pix');
 PERFORM set_config('request.jwt.claim.sub',v_staff::text,true);
 IF public.can_manage_shop_operations(v_shop) THEN RAISE EXCEPTION 'FAIL permission defaults on'; END IF;
 PERFORM set_config('request.jwt.claim.sub',v_owner::text,true);
 UPDATE public.barbers SET can_manage_operations=true WHERE id=v_barber;
 PERFORM set_config('request.jwt.claim.sub',v_staff::text,true);
 PERFORM set_config('request.jwt.claim.role','authenticated',true);
 PERFORM set_config('request.jwt.claims',json_build_object('sub',v_staff,'role','authenticated')::text,true);
 EXECUTE 'SET LOCAL ROLE authenticated';
 IF NOT public.can_manage_shop_operations(v_shop) OR public.can_manage_shop_operations(v_other) THEN RAISE EXCEPTION 'FAIL access scope'; END IF;
 v_denied:=false; BEGIN INSERT INTO public.shop_customers(shop_id,name,phone) VALUES(v_other,'Unauthorized','19999990000'); EXCEPTION WHEN others THEN v_denied:=true; END;
 IF NOT v_denied THEN RAISE EXCEPTION 'FAIL cross shop insert'; END IF;
 UPDATE public.pets SET notes='QA operational update' WHERE id=v_pet;
 IF NOT FOUND THEN RAISE EXCEPTION 'FAIL pet update'; END IF;
 PERFORM public.save_pet_service_duration(v_shop,v_service,null,null,45,null);
 v_booking:=public.create_operational_booking(v_shop,v_peer,v_customer,v_pet,current_date+7,'10:00',array[v_service]);
 IF NOT public.is_booking_assignee(v_booking) THEN RAISE EXCEPTION 'FAIL peer booking access'; END IF;
 PERFORM public.edit_booking_reservation(v_booking,array[v_service],current_date+7,'11:00','QA',v_peer,45);
 PERFORM public.sell_customer_package(v_package,v_shop,v_template,v_customer,v_pet,false,null);
 PERFORM public.consume_package_session(v_package,null,'Uso manual');
 PERFORM public.update_operational_package(v_package,3,current_date+30);
 SELECT count(*) INTO v_count FROM public.financial_transactions WHERE shop_id=v_shop;
 IF v_count<>0 THEN RAISE EXCEPTION 'FAIL cash visible'; END IF;
 v_denied:=false; BEGIN PERFORM public.package_balances(v_shop); EXCEPTION WHEN others THEN v_denied:=true; END;
 IF NOT v_denied THEN RAISE EXCEPTION 'FAIL package balance exposed'; END IF;
 v_denied:=false; BEGIN PERFORM public.receive_package_payment(v_package,1,'pix',gen_random_uuid()); EXCEPTION WHEN others THEN v_denied:=true; END;
 IF NOT v_denied THEN RAISE EXCEPTION 'FAIL package cash receipt permitted'; END IF;
 v_denied:=false; BEGIN UPDATE public.barbers SET can_manage_operations=true WHERE id=v_peer; EXCEPTION WHEN others THEN v_denied:=true; END;
 -- RLS may silently filter the other professional instead of invoking the trigger.
 IF EXISTS(SELECT 1 FROM public.barbers WHERE id=v_peer AND can_manage_operations) THEN RAISE EXCEPTION 'FAIL privilege escalation'; END IF;
 v_denied:=false; BEGIN UPDATE public.barbers SET can_manage_operations=false WHERE id=v_barber; EXCEPTION WHEN others THEN v_denied:=true; END;
 IF NOT v_denied THEN RAISE EXCEPTION 'FAIL self permission mutation'; END IF;
 UPDATE public.shops SET subscription_status='active' WHERE id=v_shop;
 IF FOUND THEN RAISE EXCEPTION 'FAIL subscription update'; END IF;
 EXECUTE 'RESET ROLE';
 IF (SELECT count(*) FROM public.financial_transactions WHERE shop_id=v_shop)<>1 THEN RAISE EXCEPTION 'FAIL cash changed'; END IF;
 PERFORM set_config('request.jwt.claim.sub',v_owner::text,true);
 UPDATE public.barbers SET can_manage_operations=false WHERE id=v_barber;
 PERFORM set_config('request.jwt.claim.sub',v_staff::text,true);
 IF public.is_booking_assignee(v_booking) THEN RAISE EXCEPTION 'FAIL revocation'; END IF;
END $$;
