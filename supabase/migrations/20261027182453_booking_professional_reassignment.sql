CREATE OR REPLACE FUNCTION public.edit_operational_booking_professional(p_booking_id uuid, p_service_ids uuid[], p_date date, p_time time without time zone, p_notes text DEFAULT NULL::text, p_barber_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare b bookings%rowtype; v_amount numeric; v_minutes int; v_added numeric; v_added_minutes int;
begin
 if auth.uid() is null then raise exception 'Entre na sua conta'; end if;
 select * into b from bookings where id=p_booking_id for update;
 if b.id is null or not (is_shop_owner(b.shop_id) or is_booking_assignee(b.id)) then raise exception 'Sem permissão para editar este atendimento'; end if;
 if p_barber_id is not null and p_barber_id<>b.barber_id then
   if auth.uid() is null or not is_shop_owner(b.shop_id) then raise exception 'Somente o responsável pode trocar o profissional'; end if;
   if b.status not in ('scheduled','confirmed') then raise exception 'Troque o profissional antes de iniciar o atendimento'; end if;
   if not exists(select 1 from barbers where id=p_barber_id and shop_id=b.shop_id) then raise exception 'Profissional inválido'; end if;
   if exists(select 1 from unnest(p_service_ids) sid where exists(select 1 from service_barbers where service_id=sid) and not exists(select 1 from service_barbers where service_id=sid and barber_id=p_barber_id)) then raise exception 'Profissional não realiza os serviços selecionados'; end if;
   b.barber_id:=p_barber_id;
 end if;
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
 if exists(select 1 from shop_closures where shop_id=b.shop_id and p_date between starts_on and ends_on) then raise exception 'Estabelecimento fechado nesta data'; end if;
 if exists(select 1 from barber_time_off where barber_id=b.barber_id and p_date between starts_on and ends_on and (start_time is null or (p_time<end_time and start_time<p_time+make_interval(mins=>v_minutes)))) then raise exception 'Profissional de folga'; end if;
 insert into booking_services(booking_id,service_id) select b.id,s.id from services s where s.id=any(p_service_ids)
 and not exists(select 1 from booking_services bs where bs.booking_id=b.id and bs.service_id=s.id);
 update bookings set barber_id=b.barber_id,date=p_date,time=p_time,notes=p_notes,services_amount=v_amount,duration_minutes=v_minutes,
 quoted_amount=coalesce(b.quoted_amount,v_amount-v_added+b.extras_amount+b.pet_transport_fee-b.discount_amount+coalesce((select sum(price_delta) from booking_custom_field_answers where booking_id=b.id),0))+v_added where id=b.id;
end; $function$
;
revoke all on function public.edit_operational_booking_professional(uuid,uuid[],date,time,text,uuid) from public,anon;
grant execute on function public.edit_operational_booking_professional(uuid,uuid[],date,time,text,uuid) to authenticated;
