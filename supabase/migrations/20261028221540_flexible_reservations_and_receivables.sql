-- Additive migration: historical bookings remain unclassified (NULL).
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS amount_due numeric(12,2) CHECK(amount_due>=0);
ALTER TABLE public.financial_transactions ADD COLUMN IF NOT EXISTS payment_request_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS financial_payment_request_unique ON public.financial_transactions(payment_request_id) WHERE payment_request_id IS NOT NULL;
CREATE OR REPLACE FUNCTION public.edit_booking_reservation(p_booking_id uuid, p_service_ids uuid[], p_date date, p_time time without time zone, p_notes text DEFAULT NULL::text, p_barber_id uuid DEFAULT NULL::uuid, p_reserved_minutes integer DEFAULT NULL)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare b bookings%rowtype; v_amount numeric; v_minutes int; v_added numeric; v_added_minutes int; v_original_barber uuid; v_changed boolean;
begin
 if auth.uid() is null then raise exception 'Entre na sua conta'; end if;
 select * into b from bookings where id=p_booking_id for update;
 if b.id is null or not (is_shop_owner(b.shop_id) or is_booking_assignee(b.id)) then raise exception 'Sem permissão para editar este atendimento'; end if;
 v_original_barber:=b.barber_id;
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
 v_amount:=v_amount+v_added; v_minutes:=coalesce(p_reserved_minutes,b.duration_minutes,v_minutes); if v_minutes not between 1 and 720 then raise exception 'Informe de 1 a 720 minutos'; end if;
 v_changed:=b.barber_id is distinct from v_original_barber or p_date is distinct from b.date or p_time is distinct from b.time or v_minutes is distinct from b.duration_minutes;
 if v_changed then
 -- Serialize the professional's mutations; overlap is checked again inside the transaction.
 perform pg_advisory_xact_lock(hashtextextended(b.barber_id::text,0));
 if exists(select 1 from bookings x where x.id<>b.id and x.barber_id=b.barber_id and x.date=p_date and x.status not in ('cancelled','no_show')
 and p_time < x.time + make_interval(mins=>coalesce(x.duration_minutes,30)) and x.time < p_time + make_interval(mins=>v_minutes)) then raise exception 'O horário ou a duração conflita com outro atendimento'; end if;
 if exists(select 1 from shop_closures where shop_id=b.shop_id and p_date between starts_on and ends_on) then raise exception 'Estabelecimento fechado nesta data'; end if;
 if exists(select 1 from barber_time_off where barber_id=b.barber_id and p_date between starts_on and ends_on and (start_time is null or (p_time<end_time and start_time<p_time+make_interval(mins=>v_minutes)))) then raise exception 'Profissional de folga'; end if;
 end if;
 insert into booking_services(booking_id,service_id) select b.id,s.id from services s where s.id=any(p_service_ids)
 and not exists(select 1 from booking_services bs where bs.booking_id=b.id and bs.service_id=s.id);
 if v_changed then
   update bookings set barber_id=b.barber_id,date=p_date,time=p_time,duration_minutes=v_minutes where id=b.id;
 end if;
 update bookings set notes=p_notes,services_amount=v_amount,
 quoted_amount=coalesce(b.quoted_amount,v_amount-v_added+b.extras_amount+b.pet_transport_fee-b.discount_amount+coalesce((select sum(price_delta) from booking_custom_field_answers where booking_id=b.id),0))+v_added where id=b.id;
end; $function$
;
CREATE OR REPLACE FUNCTION public.complete_booking_payment(p_booking_id uuid, p_service_ids uuid[], p_payment_method text, p_amount numeric, p_customer_package_id uuid DEFAULT NULL::uuid, p_paid_now boolean DEFAULT true, p_transport_fee numeric DEFAULT NULL, p_reserved_minutes integer DEFAULT NULL)
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
  IF p_paid_now AND (p_payment_method IS NULL OR p_payment_method NOT IN ('pix', 'cartao', 'dinheiro')) THEN
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
  if auth.uid() is null or p_paid_now is null then raise exception 'Solicitação inválida'; end if;
  perform edit_booking_reservation(p_booking_id,p_service_ids,v_booking.date,v_booking.time,v_booking.notes,null,p_reserved_minutes);
  if p_transport_fee is not null then
    if not v_booking.pet_transport_requested or p_transport_fee<0 or p_transport_fee>999999.99 or p_transport_fee::text in ('NaN','Infinity','-Infinity') then raise exception 'Transporte inválido'; end if;
    update bookings set quoted_amount=quoted_amount-pet_transport_fee+round(p_transport_fee,2),pet_transport_fee=round(p_transport_fee,2) where id=p_booking_id;
  end if;
  select quoted_amount into v_total from bookings where id=p_booking_id;
  if p_customer_package_id is not null then
    select greatest(0,quoted_amount-coalesce(v_booking.services_amount,0)) into v_total from bookings where id=p_booking_id;
  end if;
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
    payment_method = case when p_paid_now and v_total>0 then p_payment_method else null end,
    amount_due = v_total,
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

  IF p_paid_now AND v_total>0 THEN
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
  END IF;

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



REVOKE ALL ON FUNCTION public.edit_booking_reservation(uuid,uuid[],date,time,text,uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.edit_booking_reservation(uuid,uuid[],date,time,text,uuid,integer) TO authenticated;
REVOKE ALL ON FUNCTION public.complete_booking_payment(uuid,uuid[],text,numeric,uuid,boolean,numeric,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.complete_booking_payment(uuid,uuid[],text,numeric,uuid,boolean,numeric,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.receive_booking_payment(p_booking_id uuid,p_amount numeric,p_method text,p_request_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b bookings%rowtype; paid numeric; existing financial_transactions%rowtype;
BEGIN
 SELECT * INTO b FROM bookings WHERE id=p_booking_id FOR UPDATE;
 IF auth.uid() IS NULL OR b.id IS NULL OR NOT is_shop_owner(b.shop_id) THEN RAISE EXCEPTION 'Somente o responsável pode registrar recebimentos'; END IF;
 IF p_request_id IS NULL OR p_amount IS NULL OR p_amount<=0 OR p_amount::text IN ('NaN','Infinity','-Infinity') OR round(p_amount,2)<>p_amount OR p_method IS NULL OR p_method NOT IN ('pix','cartao','dinheiro') THEN RAISE EXCEPTION 'Pagamento inválido'; END IF;
 SELECT * INTO existing FROM financial_transactions WHERE payment_request_id=p_request_id;
 IF existing.id IS NOT NULL THEN
   IF existing.booking_id<>b.id OR existing.amount<>p_amount OR existing.payment_method<>p_method THEN RAISE EXCEPTION 'Operação já utilizada'; END IF;
   RETURN;
 END IF;
 IF b.status<>'completed' OR b.amount_due IS NULL THEN RAISE EXCEPTION 'Atendimento sem cobrança pendente'; END IF;
 SELECT coalesce(sum(amount),0) INTO paid FROM financial_transactions WHERE booking_id=b.id AND type='entrada';
 IF p_amount>b.amount_due-paid THEN RAISE EXCEPTION 'O valor supera o saldo pendente. Atualize a tela.'; END IF;
 INSERT INTO financial_transactions(shop_id,booking_id,type,description,amount,payment_method,payment_request_id)
 VALUES(b.shop_id,b.id,'entrada','Recebimento - '||b.client_name,p_amount,p_method,p_request_id);
END; $$;
REVOKE ALL ON FUNCTION public.receive_booking_payment(uuid,numeric,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.receive_booking_payment(uuid,numeric,text,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.booking_receivables(p_shop_id uuid)
RETURNS TABLE(booking_id uuid,client_name text,booking_date date,total numeric,received numeric,balance numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT is_shop_owner(p_shop_id) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
 RETURN QUERY SELECT b.id,b.client_name,b.date,b.amount_due,coalesce(t.paid,0),b.amount_due-coalesce(t.paid,0)
 FROM bookings b LEFT JOIN LATERAL (SELECT sum(f.amount) paid FROM financial_transactions f WHERE f.booking_id=b.id AND f.type='entrada') t ON true
 WHERE b.shop_id=p_shop_id AND b.status='completed' AND b.amount_due>coalesce(t.paid,0) ORDER BY b.date,b.id;
END; $$;
REVOKE ALL ON FUNCTION public.booking_receivables(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.booking_receivables(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.completion_packages(p_booking_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b bookings%rowtype; result jsonb;
BEGIN
 SELECT * INTO b FROM bookings WHERE id=p_booking_id;
 IF auth.uid() IS NULL OR b.id IS NULL OR NOT(is_shop_owner(b.shop_id) OR is_booking_assignee(b.id)) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(cp)||jsonb_build_object('service_packages',jsonb_build_object('name',sp.name))),'[]'::jsonb) INTO result
 FROM customer_packages cp JOIN service_packages sp ON sp.id=cp.package_id
 WHERE cp.shop_id=b.shop_id AND cp.customer_id=b.shop_customer_id AND cp.pet_id=b.pet_id AND cp.status='active' AND cp.used_sessions<cp.total_sessions AND (cp.expires_at IS NULL OR cp.expires_at >= (now() at time zone 'America/Sao_Paulo')::date);
 RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.completion_packages(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.completion_packages(uuid) TO authenticated;
