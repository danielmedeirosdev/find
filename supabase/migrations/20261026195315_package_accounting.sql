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
  if p_customer_package_id is not null then
    select greatest(0,quoted_amount-coalesce(services_amount,0)) into v_total from bookings where id=p_booking_id;
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


-- The instance ID is an idempotency key, retained by the client across failed requests.
create or replace function public.assign_operational_package(p_id uuid,p_shop_id uuid,p_template_id uuid,p_customer_id uuid,p_pet_id uuid,p_record_payment boolean default false)
returns uuid language plpgsql security definer set search_path=public as $$
declare t service_packages%rowtype;
begin
 if not is_shop_owner(p_shop_id) then raise exception 'Sem permissão'; end if;
 if exists(select 1 from customer_packages where id=p_id and shop_id=p_shop_id) then return p_id; end if;
 select * into t from service_packages where id=p_template_id and shop_id=p_shop_id and active;
 if t.id is null or not exists(select 1 from pets where id=p_pet_id and shop_id=p_shop_id and customer_id=p_customer_id) then raise exception 'Confira pacote, cliente e pet'; end if;
 insert into customer_packages(id,shop_id,package_id,customer_id,pet_id,total_sessions,used_sessions,expires_at,status)
 values(p_id,p_shop_id,t.id,p_customer_id,p_pet_id,t.total_sessions,0,case when t.validity_days is null then null else current_date+t.validity_days end,'active');
 if p_record_payment and t.price>0 then
  insert into financial_transactions(shop_id,type,description,amount,payment_method)
  values(p_shop_id,'entrada','Pacote - '||t.name,t.price,'pix');
 end if;
 return p_id;
end; $$;
revoke all on function public.assign_operational_package(uuid,uuid,uuid,uuid,uuid,boolean) from public,anon;
grant execute on function public.assign_operational_package(uuid,uuid,uuid,uuid,uuid,boolean) to authenticated;
