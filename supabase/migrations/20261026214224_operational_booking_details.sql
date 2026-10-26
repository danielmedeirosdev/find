-- A private operational contact can start with a phone and no invented name.
create function public.quick_register_customer(p_shop_id uuid,p_phone text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_phone text:=public.normalize_br_phone(p_phone); c public.shop_customers%rowtype;
begin
 if not (public.is_shop_owner(p_shop_id) or public.is_shop_staff(p_shop_id)) then raise exception 'Sem permissão para cadastrar clientes'; end if;
 if v_phone is null or length(v_phone) not between 10 and 11 then raise exception 'Informe um WhatsApp válido com DDD.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_shop_id::text||':'||v_phone,0));
 select * into c from public.shop_customers where shop_id=p_shop_id and public.normalize_br_phone(phone)=v_phone order by created_at,id limit 1;
 if c.id is null then
   insert into public.shop_customers(shop_id,name,phone) values(p_shop_id,'',v_phone) on conflict(shop_id,phone) do nothing returning * into c;
   if c.id is null then select * into c from public.shop_customers where shop_id=p_shop_id and public.normalize_br_phone(phone)=v_phone order by created_at,id limit 1; end if;
 end if;
 return to_jsonb(c);
end; $$;
revoke all on function public.quick_register_customer(uuid,text) from public,anon;
grant execute on function public.quick_register_customer(uuid,text) to authenticated;

-- Keep the established 7-argument API compatible. Details, prices and services
-- are saved in the same transaction, with the existing permission/slot guards.
create function public.create_operational_booking_with_details(
 p_shop_id uuid,p_barber_id uuid,p_customer_id uuid,p_pet_id uuid,p_date date,p_time time,p_service_ids uuid[],
 p_notes text default null,p_pet_transport boolean default false,p_transport_address text default null,
 p_transport_notes text default null,p_transport_fee numeric default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_fee numeric:=0; b public.bookings%rowtype;
begin
 if not (public.is_shop_owner(p_shop_id) or (public.is_shop_staff(p_shop_id) and public.staff_barber_id(p_shop_id)=p_barber_id)) then raise exception 'Sem permissão para agendar'; end if;
 if length(coalesce(p_notes,''))>1000 then raise exception 'A observação deve ter até 1000 caracteres.'; end if;
 if coalesce(p_pet_transport,false) then
   if length(btrim(coalesce(p_transport_address,''))) not between 5 and 500 then raise exception 'Informe um endereço válido para buscar o pet.'; end if;
   if length(coalesce(p_transport_notes,''))>500 then raise exception 'As instruções do transporte devem ter até 500 caracteres.'; end if;
   select case when bool_or(pricing_mode='quote') then 0 else max(fee) end into v_fee
    from public.service_pet_transport where shop_id=p_shop_id and service_id=any(p_service_ids) and enabled;
   if v_fee is null then raise exception 'Táxi Pet indisponível para os serviços escolhidos.'; end if;
   if p_transport_fee is not null then v_fee:=p_transport_fee; end if;
   if v_fee<0 or v_fee>999999.99 then raise exception 'Informe um valor válido para o Táxi Pet.'; end if;
 end if;
 v_id:=public.create_operational_booking(p_shop_id,p_barber_id,p_customer_id,p_pet_id,p_date,p_time,p_service_ids);
 update public.bookings set
  client_name=coalesce(nullif(btrim(client_name),''),client_phone),
  notes=nullif(btrim(p_notes),''),
  pet_transport_requested=coalesce(p_pet_transport,false),pet_transport_fee=v_fee,
  pet_transport_address=case when p_pet_transport then btrim(p_transport_address) else null end,
  pet_transport_notes=case when p_pet_transport then nullif(btrim(p_transport_notes),'') else null end,
  quoted_amount=round(quoted_amount+v_fee,2)
 where id=v_id returning * into b;
 return to_jsonb(b);
end; $$;
revoke all on function public.create_operational_booking_with_details(uuid,uuid,uuid,uuid,date,time,uuid[],text,boolean,text,text,numeric) from public,anon;
grant execute on function public.create_operational_booking_with_details(uuid,uuid,uuid,uuid,date,time,uuid[],text,boolean,text,text,numeric) to authenticated;

-- Only fill a missing name on the public flow; existing names stay intact.
CREATE OR REPLACE FUNCTION public.upsert_pet_customer(p_shop_id uuid, p_phone text, p_name text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_phone TEXT := public.normalize_br_phone(p_phone);
  v_name TEXT := trim(COALESCE(p_name, ''));
  v_customer public.shop_customers%ROWTYPE;
BEGIN
  IF v_phone IS NULL OR length(v_phone) NOT BETWEEN 10 AND 11 THEN
    RAISE EXCEPTION 'Telefone inválido';
  END IF;
  IF length(v_name) NOT BETWEEN 2 AND 120 THEN
    RAISE EXCEPTION 'Nome inválido';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.shops s
    WHERE s.id = p_shop_id
      AND s.segment = 'pet'
      AND s.subscription_status != 'blocked'
  ) THEN
    RAISE EXCEPTION 'Estabelecimento inválido';
  END IF;

  SELECT sc.*
  INTO v_customer
  FROM public.shop_customers sc
  WHERE sc.shop_id = p_shop_id
    AND public.normalize_br_phone(sc.phone) = v_phone
  LIMIT 1;

  IF v_customer.id IS NULL THEN
    INSERT INTO public.shop_customers (shop_id, name, phone)
    VALUES (p_shop_id, v_name, v_phone)
    ON CONFLICT (shop_id, phone) DO NOTHING;

    SELECT sc.*
    INTO v_customer
    FROM public.shop_customers sc
    WHERE sc.shop_id = p_shop_id
      AND public.normalize_br_phone(sc.phone) = v_phone
    LIMIT 1;
  END IF;

  IF btrim(v_customer.name) = '' THEN
    UPDATE public.shop_customers SET name=v_name WHERE id=v_customer.id AND btrim(name)='' RETURNING * INTO v_customer;
    IF v_customer.id IS NULL THEN SELECT sc.* INTO v_customer FROM public.shop_customers sc WHERE sc.shop_id=p_shop_id AND public.normalize_br_phone(sc.phone)=v_phone LIMIT 1; END IF;
  END IF;

  RETURN jsonb_build_object(
    'id', v_customer.id,
    'shop_id', v_customer.shop_id,
    'name', v_customer.name,
    'phone', v_phone
  );
END;
$function$;
