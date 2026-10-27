-- Run inside BEGIN / ROLLBACK, using isolated fixtures only.
do $$
declare u uuid:=gen_random_uuid(); sh uuid; c uuid:=gen_random_uuid(); pet uuid:=gen_random_uuid(); staff uuid:=gen_random_uuid(); other_staff uuid:=gen_random_uuid(); s uuid:=gen_random_uuid(); b uuid; d date:=current_date+7; rejected boolean;
begin
  insert into auth.users(id,email,raw_user_meta_data) values(u,'qa.availability.'||u||'@example.com','{"role":"barber","segment":"pet","shop_name":"QA availability"}');
  select id into sh from public.shops where owner_user_id=u;
  insert into public.barbers(id,shop_id,name) values(staff,sh,'QA schedule'),(other_staff,sh,'QA other professional');
  insert into public.barber_schedule(barber_id,day_of_week,is_active,start_time,end_time) select staff,day,true,'09:00','18:00' from generate_series(0,6) day;
  insert into public.shop_customers(id,shop_id,name,phone) values(c,sh,'QA Customer','19999990000');
  insert into public.pets(id,shop_id,customer_id,name) values(pet,sh,c,'QA Pet');
  insert into public.services(id,shop_id,name,price,duration_minutes) values(s,sh,'QA Bath',50,60);
  insert into public.service_barbers(service_id,barber_id,shop_id) values(s,staff,sh);
  execute 'set local role anon';
  if (select count(*) from public.service_barbers where service_id=s)<>1 or (select count(*) from public.barber_schedule where barber_id=staff)<>7 then raise exception 'FAIL anonymous availability lookup'; end if;
  execute 'reset role';
  perform set_config('request.jwt.claim.sub',u::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',u,'role','authenticated')::text,true);
  insert into public.barber_schedule(barber_id,day_of_week,is_active,start_time,end_time) select other_staff,day,true,'09:00','18:00' from generate_series(0,6) day;
  insert into public.service_barbers(service_id,barber_id,shop_id) values(s,other_staff,sh);
  b:=public.create_operational_booking(sh,staff,c,pet,d,'10:00',array[s]);
  perform public.edit_operational_booking_professional(b,array[s],d,'11:00','QA reassignment',other_staff);
  if not exists(select 1 from public.bookings where id=b and barber_id=other_staff and time='11:00' and quoted_amount=50 and duration_minutes=60) then raise exception 'FAIL reassignment persistence'; end if;
  perform public.create_operational_booking(sh,staff,c,pet,d,'11:00',array[s]);
  rejected:=false;
  begin perform public.edit_operational_booking_professional(b,array[s],d,'11:00',null,staff); exception when others then rejected:=true; end;
  if not rejected then raise exception 'FAIL occupied professional accepted'; end if;
  if (select barber_id from public.bookings where id=b)<>other_staff then raise exception 'FAIL partial save'; end if;
  rejected:=false;
  begin perform public.edit_operational_booking_professional(b,array[s],d,'08:00',null,staff); exception when others then rejected:=true; end;
  if not rejected then raise exception 'FAIL outside schedule'; end if;
  perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
  rejected:=false;
  begin perform public.edit_operational_booking_professional(b,array[s],d,'12:00',null,staff); exception when others then rejected:=true; end;
  if not rejected then raise exception 'FAIL unauthorized write'; end if;
end; $$;
