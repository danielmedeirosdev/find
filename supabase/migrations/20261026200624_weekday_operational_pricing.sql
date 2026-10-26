-- Apply the same weekday and per-size prices to public and operational bookings.
-- Respect per-size service rules for internal bookings and additions.
create or replace function public.edit_operational_booking(p_booking_id uuid,p_service_ids uuid[],p_date date,p_time time,p_notes text default null)
returns void language plpgsql security definer set search_path = public as $$
declare b bookings%rowtype; v_amount numeric; v_minutes int; v_added numeric; v_added_minutes int;
begin
 select * into b from bookings where id=p_booking_id for update;
 if b.id is null or not (is_shop_owner(b.shop_id) or is_booking_assignee(b.id)) then raise exception 'Sem permissão para editar este atendimento'; end if;
 if b.status in ('completed','cancelled','no_show') then raise exception 'Atendimento encerrado não pode ser editado'; end if;
 if p_date is null or p_time is null or coalesce(cardinality(p_service_ids),0)=0 then raise exception 'Informe data, horário e serviços'; end if;
 if exists(select 1 from unnest(p_service_ids) sid where not exists(select 1 from services s where s.id=sid and s.shop_id=b.shop_id)) then raise exception 'Serviço inválido'; end if;
 if exists(select 1 from booking_services where booking_id=b.id and not(service_id=any(p_service_ids))) then raise exception 'Os serviços já combinados devem ser mantidos'; end if;
 select coalesce(sum(round(coalesce(r.price,s.price)*(1-coalesce(w.discount_percent,0)/100),2)),0),coalesce(sum(coalesce(r.duration_minutes,s.duration_minutes)),0) into v_added,v_added_minutes from services s left join pets p on p.id=b.pet_id left join service_size_rules r on r.service_id=s.id and r.size=p.size left join service_weekday_discounts w on w.service_id=s.id and w.day_of_week=extract(dow from p_date)
 where s.id=any(p_service_ids) and not exists(select 1 from booking_services bs where bs.booking_id=b.id and bs.service_id=s.id);
 select coalesce(b.services_amount,sum(s.price),0),coalesce(b.duration_minutes,sum(s.duration_minutes),0)
 into v_amount,v_minutes from booking_services bs join services s on s.id=bs.service_id where bs.booking_id=b.id;
 v_amount:=v_amount+v_added; v_minutes:=v_minutes+v_added_minutes;
 -- Serialize the professional's mutations; overlap is checked again inside the transaction.
 perform pg_advisory_xact_lock(hashtextextended(b.barber_id::text,0));
 if exists(select 1 from bookings x where x.id<>b.id and x.barber_id=b.barber_id and x.date=p_date and x.status not in ('cancelled','no_show')
 and p_time < x.time + make_interval(mins=>coalesce(x.duration_minutes,30)) and x.time < p_time + make_interval(mins=>v_minutes)) then raise exception 'O horário ou a duração conflita com outro atendimento'; end if;
 insert into booking_services(booking_id,service_id) select b.id,s.id from services s where s.id=any(p_service_ids)
 and not exists(select 1 from booking_services bs where bs.booking_id=b.id and bs.service_id=s.id);
 update bookings set date=p_date,time=p_time,notes=p_notes,services_amount=v_amount,duration_minutes=v_minutes,
 quoted_amount=coalesce(b.quoted_amount,v_amount-v_added+b.extras_amount+b.pet_transport_fee-b.discount_amount+coalesce((select sum(price_delta) from booking_custom_field_answers where booking_id=b.id),0))+v_added where id=b.id;
end; $$;
revoke all on function public.edit_operational_booking(uuid,uuid[],date,time,text) from public,anon;
grant execute on function public.edit_operational_booking(uuid,uuid[],date,time,text) to authenticated;

create or replace function public.create_operational_booking(p_shop_id uuid,p_barber_id uuid,p_customer_id uuid,p_pet_id uuid,p_date date,p_time time,p_service_ids uuid[])
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; c shop_customers%rowtype; v_price numeric; v_duration int;
begin
 if not (is_shop_owner(p_shop_id) or (is_shop_staff(p_shop_id) and staff_barber_id(p_shop_id)=p_barber_id)) then raise exception 'Sem permissão para agendar'; end if;
 select * into c from shop_customers where id=p_customer_id and shop_id=p_shop_id;
 if c.id is null or not exists(select 1 from pets where id=p_pet_id and customer_id=c.id and shop_id=p_shop_id) then raise exception 'Cliente ou pet inválido'; end if;
 if not exists(select 1 from barbers where id=p_barber_id and shop_id=p_shop_id) then raise exception 'Profissional inválido'; end if;
 if coalesce(cardinality(p_service_ids),0)=0 or exists(select 1 from unnest(p_service_ids) sid where not exists(select 1 from services where id=sid and shop_id=p_shop_id and is_active)) then raise exception 'Selecione serviços ativos do estabelecimento'; end if;
 if p_date is null or p_time is null or p_date < (now() at time zone 'America/Sao_Paulo')::date then raise exception 'Data inválida'; end if;
 select sum(round(coalesce(r.price,s.price)*(1-coalesce(w.discount_percent,0)/100),2)),sum(coalesce(r.duration_minutes,s.duration_minutes)) into v_price,v_duration from services s left join pets p on p.id=p_pet_id left join service_size_rules r on r.service_id=s.id and r.size=p.size left join service_weekday_discounts w on w.service_id=s.id and w.day_of_week=extract(dow from p_date) where s.id=any(p_service_ids);
 perform pg_advisory_xact_lock(hashtextextended(p_barber_id::text,0));
 if exists(select 1 from bookings b where b.barber_id=p_barber_id and b.date=p_date and b.status not in ('cancelled','no_show') and p_time < b.time+make_interval(mins=>coalesce(b.duration_minutes,30)) and b.time < p_time+make_interval(mins=>v_duration)) then raise exception 'Horário indisponível'; end if;
 if exists(select 1 from shop_closures where shop_id=p_shop_id and p_date between starts_on and ends_on) then raise exception 'Estabelecimento fechado nesta data'; end if;
 if exists(select 1 from barber_time_off where barber_id=p_barber_id and p_date between starts_on and ends_on and (start_time is null or (p_time<end_time and start_time<p_time+make_interval(mins=>v_duration)))) then raise exception 'Profissional de folga'; end if;
 insert into bookings(shop_id,barber_id,shop_customer_id,pet_id,client_name,client_phone,date,time,duration_minutes,services_amount,quoted_amount,status)
 values(p_shop_id,p_barber_id,c.id,p_pet_id,c.name,c.phone,p_date,p_time,v_duration,v_price,v_price,'scheduled') returning id into v_id;
 insert into booking_services(booking_id,service_id) select v_id,id from services where id=any(p_service_ids);
 return v_id;
end; $$;
revoke all on function public.create_operational_booking(uuid,uuid,uuid,uuid,date,time,uuid[]) from public,anon;
grant execute on function public.create_operational_booking(uuid,uuid,uuid,uuid,date,time,uuid[]) to authenticated;

