-- Isolated fixtures; rollback leaves no tenant data behind.
do $$
declare u uuid:=gen_random_uuid(); sh uuid:=gen_random_uuid(); c uuid:=gen_random_uuid(); pet uuid:=gen_random_uuid(); staff uuid:=gen_random_uuid(); s1 uuid:=gen_random_uuid(); s2 uuid:=gen_random_uuid(); b uuid; b2 uuid; tpl uuid:=gen_random_uuid(); cp uuid:=gen_random_uuid(); n int;
begin
 insert into auth.users(id,email) values(u,'qa.workspace.'||u||'@example.com');
 insert into shops(id,owner_user_id,name,segment) values(sh,u,'QA rollback only','pet');
 insert into barbers(id,shop_id,name) values(staff,sh,'QA Professional');
 insert into barber_schedule(barber_id,day_of_week,is_active,start_time,end_time) select staff,day,true,'09:00','18:00' from generate_series(0,6) day;
 insert into shop_customers(id,shop_id,name,phone) values(c,sh,'QA Customer','19999990000');
 insert into pets(id,shop_id,customer_id,name) values(pet,sh,c,'QA Pet');
 insert into services(id,shop_id,name,price,duration_minutes) values(s1,sh,'QA Bath',59.90,30),(s2,sh,'QA Extra',20.10,15);
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform set_config('request.jwt.claims',json_build_object('sub',u,'role','authenticated')::text,true);
 b:=create_operational_booking(sh,staff,c,pet,current_date+1,'10:00',array[s1]);
 if (select quoted_amount from bookings where id=b)<>59.90 then raise exception 'FAIL initial quote'; end if;
 perform edit_operational_booking(b,array[s1,s2],current_date+1,'10:00','edited');
 if (select quoted_amount from bookings where id=b)<>80 or (select duration_minutes from bookings where id=b)<>45 then raise exception 'FAIL edit total or duration'; end if;
 perform edit_operational_booking(b,array[s1,s2],current_date+1,'10:00','edited twice');
 if (select count(*) from booking_services where booking_id=b)<>2 then raise exception 'FAIL duplicate service'; end if;
 begin
  perform create_operational_booking(sh,staff,c,pet,current_date+1,'10:15',array[s1]);
  raise exception 'FAIL overlap allowed';
 exception when others then if sqlerrm='FAIL overlap allowed' then raise; end if; end;
 perform update_booking_status(b,'confirmed');
 perform update_booking_status(b,'in_progress');
 begin
  perform complete_booking(b,array[s1,s2],'pix',0,null);
  raise exception 'FAIL forged amount allowed';
 exception when others then if sqlerrm='FAIL forged amount allowed' then raise; end if; end;
 perform complete_booking(b,array[s1,s2],'pix',80,null);
 perform complete_booking(b,array[s1,s2],'pix',80,null);
 if (select count(*) from financial_transactions where booking_id=b)<>1 then raise exception 'FAIL duplicate payment'; end if;
 if (select sum(amount) from financial_transactions where booking_id=b)<>80 then raise exception 'FAIL payment total'; end if;
 begin
  perform update_booking_status(b,'scheduled');
  raise exception 'FAIL reopened settled booking';
 exception when others then if sqlerrm='FAIL reopened settled booking' then raise; end if; end;
 insert into service_size_rules(service_id,size,duration_minutes,price) values(s1,'medio',60,70);
 insert into service_weekday_discounts(service_id,shop_id,day_of_week,discount_percent) values(s1,sh,extract(dow from current_date+2),10);
 b2:=create_operational_booking(sh,staff,c,pet,current_date+2,'11:00',array[s1]);
 if (select quoted_amount from bookings where id=b2)<>63 or (select duration_minutes from bookings where id=b2)<>60 then raise exception 'FAIL size/weekday pricing'; end if;
 insert into service_packages(id,shop_id,name,total_sessions,price,active) values(tpl,sh,'QA Package',4,200,true);
 perform assign_operational_package(cp,sh,tpl,c,pet,true);
 perform assign_operational_package(cp,sh,tpl,c,pet,true);
 if (select count(*) from financial_transactions where shop_id=sh and booking_id is null)<>1 then raise exception 'FAIL package payment retry'; end if;
 update bookings set extras_amount=5,quoted_amount=68 where id=b2;
 perform complete_booking(b2,array[s1],'pix',5,cp);
 perform complete_booking(b2,array[s1],'pix',5,cp);
 if (select used_sessions from customer_packages where id=cp)<>1 or (select count(*) from package_usages where booking_id=b2)<>1 then raise exception 'FAIL package duplicate consumption'; end if;
 if (select sum(amount) from financial_transactions where booking_id=b2)<>5 then raise exception 'FAIL package-covered charge'; end if;
 perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 begin
  perform edit_operational_booking(b,array[s1],current_date+1,'11:00',null);
  raise exception 'FAIL cross tenant allowed';
 exception when others then if sqlerrm='FAIL cross tenant allowed' then raise; end if; end;
end; $$;
