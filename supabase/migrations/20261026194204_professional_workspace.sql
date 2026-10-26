-- Atomic operational writes. All access follows existing owner/assignee predicates.
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
 select coalesce(sum(s.price),0),coalesce(sum(s.duration_minutes),0) into v_added,v_added_minutes from services s
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
 select sum(price),sum(duration_minutes) into v_price,v_duration from services where id=any(p_service_ids);
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

CREATE OR REPLACE FUNCTION public.complete_booking(p_booking_id uuid, p_service_ids uuid[], p_payment_method text, p_amount numeric, p_customer_package_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_shop_id UUID;
  v_booking bookings%rowtype;
  v_total numeric;
  v_client_name TEXT;
  v_client_id UUID;
  v_shop_customer_id UUID;
  v_client_phone TEXT;
  v_pet_name TEXT;
  v_phone_digits TEXT;
  v_allow_review BOOLEAN := false;
  v_customer_key TEXT;
BEGIN
  IF p_payment_method IS NULL OR p_payment_method NOT IN ('pix', 'cartao', 'dinheiro') THEN
    RAISE EXCEPTION 'Forma de pagamento inválida';
  END IF;

  IF p_service_ids IS NULL OR array_length(p_service_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Selecione ao menos um serviço';
  END IF;

  SELECT b.shop_id, b.client_name, b.client_id, b.shop_customer_id, b.client_phone, p.name
  INTO v_shop_id, v_client_name, v_client_id, v_shop_customer_id, v_client_phone, v_pet_name
  FROM bookings b
  LEFT JOIN pets p ON p.id = b.pet_id
  WHERE b.id = p_booking_id
  FOR UPDATE OF b;

  IF v_shop_id IS NULL THEN
    RAISE EXCEPTION 'Agendamento não encontrado';
  END IF;

  IF NOT (is_shop_owner(v_shop_id) OR is_booking_assignee(p_booking_id)) THEN
    RAISE EXCEPTION 'Sem permissão para finalizar este atendimento';
  END IF;

  select * into v_booking from bookings where id=p_booking_id;
  if v_booking.status = 'completed' then return; end if;
  if v_booking.status in ('cancelled','no_show') then raise exception 'Atendimento encerrado'; end if;
  perform edit_operational_booking(p_booking_id,p_service_ids,v_booking.date,v_booking.time,v_booking.notes);
  select quoted_amount into v_total from bookings where id=p_booking_id;
  if p_amount is null or p_amount < 0 or p_amount::text in ('NaN','Infinity','-Infinity') or round(p_amount,2) <> round(v_total,2) then raise exception 'O total mudou. Atualize o atendimento e confira o valor'; end if;
  if p_customer_package_id is not null and not exists(select 1 from customer_packages cp where cp.id=p_customer_package_id and cp.shop_id=v_shop_id and cp.pet_id=v_booking.pet_id and cp.customer_id=v_booking.shop_customer_id) then raise exception 'Pacote não pertence ao cliente e pet do atendimento'; end if;

  v_phone_digits := regexp_replace(COALESCE(v_client_phone, ''), '[^0-9]', '', 'g');

  IF v_client_id IS NOT NULL THEN
    v_customer_key := 'c:' || v_client_id::text;
  ELSIF v_shop_customer_id IS NOT NULL THEN
    v_customer_key := 's:' || v_shop_customer_id::text;
  ELSIF length(v_phone_digits) >= 10 THEN
    v_customer_key := 'p:' || v_phone_digits;
  ELSE
    v_customer_key := NULL;
  END IF;

  IF v_customer_key IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM reviews r
      LEFT JOIN clients c ON c.id = r.client_id
      WHERE r.shop_id = v_shop_id
        AND (
          (v_client_id IS NOT NULL AND r.client_id = v_client_id)
          OR (
            length(v_phone_digits) >= 10
            AND regexp_replace(COALESCE(c.phone, ''), '[^0-9]', '', 'g') = v_phone_digits
          )
        )
    ) THEN
      v_allow_review := false;
    ELSIF EXISTS (
      SELECT 1
      FROM bookings earlier
      WHERE earlier.shop_id = v_shop_id
        AND earlier.id <> p_booking_id
        AND earlier.status = 'completed'
        AND (
          (v_client_id IS NOT NULL AND earlier.client_id = v_client_id)
          OR (v_shop_customer_id IS NOT NULL AND earlier.shop_customer_id = v_shop_customer_id)
          OR (
            length(v_phone_digits) >= 10
            AND regexp_replace(COALESCE(earlier.client_phone, ''), '[^0-9]', '', 'g') = v_phone_digits
          )
        )
    ) THEN
      v_allow_review := false;
    ELSE
      v_allow_review := true;
    END IF;
  END IF;

  UPDATE bookings
  SET
    status = 'completed',
    payment_method = p_payment_method,
    completed_at = now(),
    review_status = CASE
      WHEN v_allow_review THEN 'awaiting'
      ELSE 'unavailable'
    END
  WHERE id = p_booking_id;

  DELETE FROM booking_services WHERE booking_id = p_booking_id;

  INSERT INTO booking_services (booking_id, service_id)
  SELECT DISTINCT p_booking_id, sid
  FROM unnest(p_service_ids) AS sid;

  INSERT INTO financial_transactions (
    shop_id, booking_id, type, description, amount, payment_method
  ) VALUES (
    v_shop_id,
    p_booking_id,
    'entrada',
    'Atendimento - ' || COALESCE(v_pet_name || ' / ', '') || v_client_name,
    p_amount,
    p_payment_method
  );

  IF p_customer_package_id IS NOT NULL THEN
    PERFORM consume_package_session(p_customer_package_id, p_booking_id, 'Uso no atendimento');
  END IF;

  PERFORM notify_shop_owner(
    v_shop_id,
    'booking_completed',
    'Atendimento concluído',
    COALESCE(v_pet_name, v_client_name) || ' finalizado.',
    p_booking_id
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_booking_status(p_booking_id uuid, p_status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_shop_id UUID;
  v_status text;
  v_client TEXT;
  v_pet TEXT;
BEGIN
  IF p_status NOT IN ('confirmed', 'in_progress', 'awaiting_payment', 'no_show', 'cancelled', 'scheduled') THEN
    RAISE EXCEPTION 'Status inválido';
  END IF;

  SELECT b.shop_id, b.client_name, p.name
  INTO v_shop_id, v_client, v_pet
  FROM bookings b
  LEFT JOIN pets p ON p.id = b.pet_id
  WHERE b.id = p_booking_id
  FOR UPDATE OF b;

  IF v_shop_id IS NULL THEN
    RAISE EXCEPTION 'Agendamento não encontrado';
  END IF;

  IF NOT (is_shop_owner(v_shop_id) OR is_booking_assignee(p_booking_id)) THEN
    RAISE EXCEPTION 'Sem permissão para atualizar este agendamento';
  END IF;

  select status into v_status from bookings where id=p_booking_id;
  if v_status in ('completed','cancelled','no_show') then raise exception 'Atendimento encerrado não pode mudar de status'; end if;
  UPDATE bookings SET status = p_status WHERE id = p_booking_id;

  IF p_status = 'no_show' THEN
    PERFORM notify_shop_owner(
      v_shop_id,
      'no_show',
      'Falta registrada',
      COALESCE(v_pet, v_client) || ' marcado como não compareceu.',
      p_booking_id
    );
  ELSIF p_status = 'cancelled' THEN
    PERFORM notify_shop_owner(
      v_shop_id,
      'booking_cancelled',
      'Agendamento cancelado',
      COALESCE(v_pet, v_client) || ' — horário liberado.',
      p_booking_id
    );
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.consume_package_session(p_customer_package_id uuid, p_booking_id uuid DEFAULT NULL::uuid, p_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_shop_id UUID;
  v_used INT;
  v_total INT;
  v_status TEXT;
  v_expires DATE;
  v_remaining INT;
  v_pet TEXT;
BEGIN
  SELECT cp.shop_id, cp.used_sessions, cp.total_sessions, cp.status, cp.expires_at, p.name
  INTO v_shop_id, v_used, v_total, v_status, v_expires, v_pet
  FROM customer_packages cp
  LEFT JOIN pets p ON p.id = cp.pet_id
  WHERE cp.id = p_customer_package_id
  FOR UPDATE OF cp;

  IF v_shop_id IS NULL THEN
    RAISE EXCEPTION 'Pacote nao encontrado';
  END IF;

  IF NOT is_shop_owner(v_shop_id) THEN
    RAISE EXCEPTION 'Sem permissao';
  END IF;

  if p_booking_id is not null then
    if not exists(select 1 from bookings b join customer_packages cp on cp.id=p_customer_package_id where b.id=p_booking_id and b.shop_id=cp.shop_id and b.pet_id=cp.pet_id and b.shop_customer_id=cp.customer_id) then raise exception 'Pacote incompatível com atendimento'; end if;
    if exists(select 1 from package_usages where customer_package_id=p_customer_package_id and booking_id=p_booking_id) then return; end if;
  end if;
  IF v_status <> 'active' THEN
    RAISE EXCEPTION 'Pacote nao esta ativo';
  END IF;

  IF v_expires IS NOT NULL AND v_expires < CURRENT_DATE THEN
    UPDATE customer_packages SET status = 'expired' WHERE id = p_customer_package_id;
    RAISE EXCEPTION 'Pacote expirado';
  END IF;

  IF v_used >= v_total THEN
    UPDATE customer_packages SET status = 'exhausted' WHERE id = p_customer_package_id;
    RAISE EXCEPTION 'Pacote sem sessoes restantes';
  END IF;

  UPDATE customer_packages
  SET
    used_sessions = used_sessions + 1,
    status = CASE WHEN used_sessions + 1 >= total_sessions THEN 'exhausted' ELSE status END
  WHERE id = p_customer_package_id;

  INSERT INTO package_usages (customer_package_id, booking_id, note)
  VALUES (p_customer_package_id, p_booking_id, NULLIF(TRIM(COALESCE(p_note, '')), ''));

  IF p_booking_id IS NOT NULL THEN
    UPDATE bookings SET customer_package_id = p_customer_package_id WHERE id = p_booking_id;
  END IF;

  v_remaining := v_total - (v_used + 1);
  IF v_remaining <= 2 THEN
    PERFORM notify_shop_owner(
      v_shop_id,
      'package_low',
      'Pacote perto do fim',
      COALESCE(v_pet, 'Pet') || ' - restam ' || v_remaining::text || ' sessao(oes).',
      p_booking_id
    );
  END IF;
END;
$function$
;

revoke all on function public.complete_booking(uuid,uuid[],text,numeric,uuid) from public,anon;
grant execute on function public.complete_booking(uuid,uuid[],text,numeric,uuid) to authenticated;

revoke all on function public.consume_package_session(uuid,uuid,text) from public,anon;
grant execute on function public.consume_package_session(uuid,uuid,text) to authenticated;

revoke all on function public.update_booking_status(uuid,text) from public,anon;
grant execute on function public.update_booking_status(uuid,text) to authenticated;
