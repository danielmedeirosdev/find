-- Run inside BEGIN / ROLLBACK against a disposable account; never persist fixtures.
DO $$
DECLARE
  owner_id uuid := gen_random_uuid(); shop_id uuid; customer_id uuid := gen_random_uuid();
  pet_id uuid := gen_random_uuid(); staff_id uuid := gen_random_uuid();
  base_id uuid := gen_random_uuid(); extra_id uuid := gen_random_uuid();
  template_id uuid := gen_random_uuid(); fixture_package_id uuid := gen_random_uuid();
  receipt_id uuid := gen_random_uuid(); fixture_booking_id uuid; rejected boolean := false;
BEGIN
  INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
    (owner_id,'qa.package.'||owner_id||'@example.com','{"role":"barber","segment":"pet","shop_name":"QA rollback"}');
  SELECT id INTO shop_id FROM public.shops WHERE owner_user_id = owner_id;
  INSERT INTO public.barbers(id,shop_id,name) VALUES(staff_id,shop_id,'QA');
  INSERT INTO public.barber_schedule(barber_id,day_of_week,is_active,start_time,end_time)
    SELECT staff_id,day,true,'09:00','18:00' FROM generate_series(0,6) day;
  INSERT INTO public.shop_customers(id,shop_id,name,phone) VALUES(customer_id,shop_id,'QA','19999990000');
  INSERT INTO public.pets(id,shop_id,customer_id,name) VALUES(pet_id,shop_id,customer_id,'QA');
  INSERT INTO public.services(id,shop_id,name,price,duration_minutes) VALUES
    (base_id,shop_id,'Banho',50,60),(extra_id,shop_id,'Extra',20,15);
  PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
  PERFORM set_config('request.jwt.claims',json_build_object('sub',owner_id,'role','authenticated')::text,true);
  INSERT INTO public.service_packages(id,shop_id,name,total_sessions,price,active)
    VALUES(template_id,shop_id,'QA pacote',4,200,true);
  PERFORM public.sell_customer_package(fixture_package_id,shop_id,template_id,customer_id,pet_id,false,null);
  PERFORM public.receive_package_payment_with_total(fixture_package_id,260,80,'pix',receipt_id);
  PERFORM public.receive_package_payment_with_total(fixture_package_id,260,80,'pix',receipt_id);
  IF (SELECT balance FROM public.package_balances(shop_id) pb WHERE pb.package_id=fixture_package_id)<>180
     OR (SELECT count(*) FROM public.package_price_adjustments a WHERE a.customer_package_id=fixture_package_id)<>1
     OR (SELECT count(*) FROM public.financial_transactions f WHERE f.customer_package_id=fixture_package_id)<>1 THEN
    RAISE EXCEPTION 'FAIL package adjustment or duplicate receipt';
  END IF;
  rejected:=false;
  BEGIN
    PERFORM public.receive_package_payment_with_total(fixture_package_id,50,1,'pix',gen_random_uuid());
  EXCEPTION WHEN others THEN rejected:=true; END;
  IF NOT rejected THEN RAISE EXCEPTION 'FAIL underpaid total accepted'; END IF;
  PERFORM set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
  rejected:=false;
  BEGIN
    PERFORM public.receive_package_payment_with_total(fixture_package_id,260,1,'pix',gen_random_uuid());
  EXCEPTION WHEN others THEN rejected:=true; END;
  IF NOT rejected THEN RAISE EXCEPTION 'FAIL unauthorized receipt'; END IF;
  PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
  fixture_booking_id:=public.create_operational_booking(shop_id,staff_id,customer_id,pet_id,current_date+7,'10:00',array[base_id]);
  UPDATE public.bookings SET status='in_progress' WHERE id=fixture_booking_id;
  PERFORM public.edit_booking_reservation(fixture_booking_id,array[base_id,extra_id],current_date+7,'10:00',null,null,60);
  IF (SELECT package_base_services_amount FROM public.bookings WHERE id=fixture_booking_id)<>50 THEN
    RAISE EXCEPTION 'FAIL base service price snapshot';
  END IF;
  PERFORM public.complete_booking_payment(fixture_booking_id,array[base_id,extra_id],'pix',20,fixture_package_id,true,null,60);
  IF (SELECT amount_due FROM public.bookings WHERE id=fixture_booking_id)<>20
     OR (SELECT count(*) FROM public.package_usages u WHERE u.booking_id=fixture_booking_id)<>1
     OR (SELECT coalesce(sum(amount),0) FROM public.financial_transactions f WHERE f.booking_id=fixture_booking_id)<>20 THEN
    RAISE EXCEPTION 'FAIL extra service separate from package';
  END IF;
END $$;
