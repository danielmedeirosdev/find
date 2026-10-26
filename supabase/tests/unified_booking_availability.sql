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
  -- The real public and internal entry points both accept the same valid slots.
  b:=public.create_operational_booking(sh,staff,c,pet,d,'10:00',array[s]);
  perform public.create_public_booking(sh,staff,'QA Customer','19999990000',d,'11:00',pet,c,60,null);
  rejected:=false;
  begin perform public.create_public_booking(sh,staff,'QA Customer','19999990000',d,'10:15',pet,c,60,null); exception when others then rejected:=true; end;
  if not rejected then raise exception 'FAIL overlap across entry points'; end if;
  rejected:=false;
  begin perform public.create_operational_booking(sh,staff,c,pet,d,'17:15',array[s]); exception when others then rejected:=true; end;
  if not rejected then raise exception 'FAIL appointment ends after working hours'; end if;
  rejected:=false;
  begin perform public.create_public_booking(sh,staff,'QA Customer','19999990000',d,'08:00',pet,c,60,null); exception when others then rejected:=true; end;
  if not rejected then raise exception 'FAIL public allows outside working hours'; end if;
  rejected:=false;
  begin perform public.create_operational_booking(sh,staff,c,pet,d,'12:07',array[s]); exception when others then rejected:=true; end;
  if not rejected then raise exception 'FAIL arbitrary time not in public slot grid'; end if;
  rejected:=false;
  begin perform public.create_operational_booking(sh,other_staff,c,pet,d,'12:00',array[s]); exception when others then rejected:=true; end;
  if not rejected then raise exception 'FAIL no schedule allowed'; end if;
  insert into public.barber_time_off(shop_id,barber_id,starts_on,ends_on,start_time,end_time) values(sh,staff,d,d,'13:00','14:00');
  rejected:=false;
  begin perform public.create_operational_booking(sh,staff,c,pet,d,'12:30',array[s]); exception when others then rejected:=true; end;
  if not rejected then raise exception 'FAIL partial time off ignored'; end if;
  insert into public.shop_closures(shop_id,starts_on,ends_on,label) values(sh,d+1,d+1,'QA closure');
  rejected:=false;
  begin perform public.create_operational_booking(sh,staff,c,pet,d+1,'10:00',array[s]); exception when others then rejected:=true; end;
  if not rejected then raise exception 'FAIL closed date accepted'; end if;
  -- Rescheduling must obey the schedule, and reject stale reservations.
  rejected:=false;
  begin perform public.edit_operational_booking(b,array[s],d,'08:00',null); exception when others then rejected:=true; end;
  if not rejected then raise exception 'FAIL rescheduling bypass'; end if;
  rejected:=false;
  begin perform public.create_operational_booking(sh,staff,c,pet,(now() at time zone 'America/Sao_Paulo')::date,'00:00',array[s]); exception when others then rejected:=true; end;
  if not rejected then raise exception 'FAIL past hour accepted'; end if;
end; $$;
