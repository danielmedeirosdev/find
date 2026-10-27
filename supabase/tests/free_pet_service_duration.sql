-- Isolated fixtures only. Execute inside BEGIN / ROLLBACK.
do $$
declare u uuid:=gen_random_uuid(); sh uuid; c uuid:=gen_random_uuid(); pet uuid:=gen_random_uuid(); staff uuid:=gen_random_uuid(); bath uuid; extra uuid; b uuid; public_b uuid; d date:=current_date+7; rejected boolean;
begin
 insert into auth.users(id,email,raw_user_meta_data) values(u,'qa.duration.'||u||'@example.com','{"role":"barber","segment":"pet","shop_name":"QA duration"}');
 select id into sh from public.shops where owner_user_id=u;
 insert into public.barbers(id,shop_id,name) values(staff,sh,'QA duration');
 insert into public.barber_schedule(barber_id,day_of_week,is_active,start_time,end_time) select staff,day,true,'09:00','18:00' from generate_series(0,6) day;
 insert into public.shop_customers(id,shop_id,name,phone) values(c,sh,'QA duration','19999990000');
 insert into public.pets(id,shop_id,customer_id,name,size) values(pet,sh,c,'QA duration','medio');
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform set_config('request.jwt.claims',json_build_object('sub',u,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 bath:=public.save_pet_service_duration(sh,null,'QA banho',50,60,null);
 extra:=public.save_pet_service_duration(sh,null,'QA escovação',10,5,null);
 perform public.save_pet_service_duration(sh,extra,null,null,1,'{"pequeno":1,"medio":3,"grande":5}');
 if (select duration_minutes from public.service_size_rules where service_id=extra and size='medio')<>3 then raise exception 'FAIL size minutes'; end if;
 perform public.save_pet_service_duration(sh,extra,null,null,5,null);
 if (select price from public.services where id=extra)<>10 then raise exception 'FAIL duration changed price'; end if;
 b:=public.create_operational_booking(sh,staff,c,pet,d,'10:00',array[bath]);
 perform public.update_booking_status(b,'confirmed');
 perform public.update_booking_status(b,'in_progress');
 perform public.edit_operational_booking(b,array[bath,extra],d,'10:00',null);
 if not exists(select 1 from public.bookings where id=b and duration_minutes=65 and quoted_amount=60) then raise exception 'FAIL additional duration or price'; end if;
 -- The additional service alone must work through the public endpoint too.
 execute 'reset role';
 execute 'set local role anon';
 public_b:=public.create_public_booking(sh,staff,'QA duration','19999990000',d,'11:15',pet,c,5,null);
 perform public.finalize_public_booking(public_b,'19999990000',array[extra],array[pet],'[]',false,null,null);
 execute 'reset role';
 if not exists(select 1 from public.bookings where id=public_b and duration_minutes=5 and quoted_amount=10) then raise exception 'FAIL public short service'; end if;
 perform set_config('request.jwt.claim.sub',u::text,true);
 execute 'set local role authenticated';
 rejected:=false;
 begin perform public.save_pet_service_duration(sh,extra,null,null,0,null); exception when others then rejected:=true; end;
 if not rejected then raise exception 'FAIL zero duration'; end if;
 rejected:=false;
 begin perform public.save_pet_service_duration(sh,extra,null,null,5,'{"pequeno":0,"medio":3,"grande":5}'); exception when others then rejected:=true; end;
 if not rejected then raise exception 'FAIL zero size duration'; end if;
 perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 rejected:=false;
 begin perform public.save_pet_service_duration(sh,extra,null,null,3,null); exception when others then rejected:=true; end;
 if not rejected then raise exception 'FAIL cross shop write'; end if;
 execute 'reset role';
end; $$;
