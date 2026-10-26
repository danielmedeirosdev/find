-- Isolated fixtures; rollback leaves no tenant data behind.
do $$
declare u uuid:=gen_random_uuid(); sh uuid:=gen_random_uuid(); c uuid:=gen_random_uuid(); pet uuid:=gen_random_uuid(); staff uuid:=gen_random_uuid(); s1 uuid:=gen_random_uuid(); s2 uuid:=gen_random_uuid(); b uuid; n int;
begin
 insert into auth.users(id) values(u);
 insert into shops(id,owner_user_id,name,segment) values(sh,u,'QA rollback only','pet');
 insert into barbers(id,shop_id,name) values(staff,sh,'QA Professional');
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
 perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 begin
  perform edit_operational_booking(b,array[s1],current_date+1,'11:00',null);
  raise exception 'FAIL cross tenant allowed';
 exception when others then if sqlerrm='FAIL cross tenant allowed' then raise; end if; end;
end; $$;
