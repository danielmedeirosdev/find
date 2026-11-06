-- Execute inside BEGIN / ROLLBACK; no fixture data survives.
DO $$
DECLARE
  owner_id uuid := gen_random_uuid(); v_shop_id uuid; customer_id uuid := gen_random_uuid();
  pet_id uuid := gen_random_uuid(); barber_id uuid := gen_random_uuid(); template_id uuid := gen_random_uuid();
  v_package_id uuid := gen_random_uuid(); manual_id uuid; linked_id uuid; v_booking_id uuid;
  rejected boolean;
BEGIN
  INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
    (owner_id,'qa.reverse.'||owner_id||'@example.com','{"role":"barber","segment":"pet","shop_name":"QA rollback"}');
  SELECT id INTO v_shop_id FROM public.shops WHERE owner_user_id=owner_id;
  INSERT INTO public.shop_customers(id,shop_id,name,phone) VALUES(customer_id,v_shop_id,'QA','19999990000');
  INSERT INTO public.pets(id,shop_id,customer_id,name) VALUES(pet_id,v_shop_id,customer_id,'QA');
  INSERT INTO public.barbers(id,shop_id,name) VALUES(barber_id,v_shop_id,'QA');
  INSERT INTO public.barber_schedule(barber_id,day_of_week,is_active,start_time,end_time)
    SELECT barber_id,day,true,'09:00','18:00' FROM generate_series(0,6) day;
  PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
  PERFORM set_config('request.jwt.claims',json_build_object('sub',owner_id,'role','authenticated')::text,true);
  INSERT INTO public.service_packages(id,shop_id,name,total_sessions,price,active)
    VALUES(template_id,v_shop_id,'QA pacote',2,100,true);
  PERFORM public.sell_customer_package(v_package_id,v_shop_id,template_id,customer_id,pet_id,false,null);
  PERFORM public.consume_package_session(v_package_id,null,'Uso manual');
  SELECT id INTO manual_id FROM public.package_usages WHERE customer_package_id=v_package_id;
  -- Booking-linked usages cannot be reversed by the manual correction endpoint.
  INSERT INTO public.bookings(shop_id,barber_id,client_name,client_phone,date,time,pet_id,shop_customer_id,status)
    VALUES(v_shop_id,barber_id,'QA','19999990000',current_date+7,'10:00',pet_id,customer_id,'completed') RETURNING id INTO v_booking_id;
  INSERT INTO public.package_usages(customer_package_id,booking_id,note)
    VALUES(v_package_id,v_booking_id,'Uso no atendimento') RETURNING id INTO linked_id;
  UPDATE public.customer_packages SET used_sessions=2,status='exhausted' WHERE id=v_package_id;
  PERFORM public.reverse_manual_package_usage(manual_id);
  PERFORM public.reverse_manual_package_usage(manual_id);
  IF (SELECT used_sessions FROM public.customer_packages WHERE id=v_package_id)<>1
     OR (SELECT status FROM public.customer_packages WHERE id=v_package_id)<>'active'
     OR (SELECT reversed_by FROM public.package_usages WHERE id=manual_id)<>owner_id
     OR (SELECT reversed_at IS NOT NULL FROM public.package_usages WHERE id=linked_id) THEN
    RAISE EXCEPTION 'FAIL correction, audit, or idempotence';
  END IF;
  rejected:=false;
  BEGIN PERFORM public.reverse_manual_package_usage(linked_id);
  EXCEPTION WHEN others THEN rejected:=true; END;
  IF NOT rejected THEN RAISE EXCEPTION 'FAIL linked booking reversal accepted'; END IF;
  PERFORM set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
  rejected:=false;
  BEGIN PERFORM public.reverse_manual_package_usage(manual_id);
  EXCEPTION WHEN others THEN rejected:=true; END;
  IF NOT rejected THEN RAISE EXCEPTION 'FAIL unauthorized reversal accepted'; END IF;
END $$;
