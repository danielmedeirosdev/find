do $$
declare u uuid:=gen_random_uuid(); st uuid:=gen_random_uuid(); sh uuid:=gen_random_uuid(); c uuid:=gen_random_uuid(); pet uuid:=gen_random_uuid(); staff uuid:=gen_random_uuid(); svc uuid:=gen_random_uuid(); b uuid; n int;
begin
 insert into auth.users(id,email) values(u,'qa.rls.owner.'||u||'@example.com'),(st,'qa.rls.staff.'||st||'@example.com');
 insert into shops(id,owner_user_id,name,segment) values(sh,u,'QA RLS rollback','pet');
 perform set_config('request.jwt.claim.role','service_role',true);
 insert into barbers(id,shop_id,user_id,name) values(staff,sh,st,'QA Staff');
 insert into barber_schedule(barber_id,day_of_week,is_active,start_time,end_time) select staff,day,true,'09:00','18:00' from generate_series(0,6) day;
 perform set_config('request.jwt.claim.role','authenticated',true);
 insert into shop_customers(id,shop_id,name,phone) values(c,sh,'QA','19999990000');
 insert into pets(id,shop_id,customer_id,name) values(pet,sh,c,'QA');
 insert into services(id,shop_id,name,price,duration_minutes) values(svc,sh,'QA Bath',50,30);
 perform set_config('request.jwt.claim.sub',st::text,true);
 perform set_config('request.jwt.claims',json_build_object('sub',st,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 if (select count(*) from shops)<>1 then raise exception 'FAIL staff sees other shops'; end if;
 if exists(select 1 from financial_transactions) then raise exception 'FAIL staff can read financial data'; end if;
 b:=create_operational_booking(sh,staff,c,pet,current_date+1,'13:00',array[svc]);
 perform update_booking_status(b,'in_progress');
 perform complete_booking(b,array[svc],'pix',50,null);
 if (select status from bookings where id=b)<>'completed' then raise exception 'FAIL staff completion'; end if;
 perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 if exists(select 1 from bookings where id=b) then raise exception 'FAIL unrelated account sees booking'; end if;
 execute 'reset role';
end; $$;
