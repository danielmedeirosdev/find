-- Both entry points obey the same working hours and overlap rules at write time.
-- Existing bookings are untouched. In-progress additions remain available.
create function private.enforce_booking_availability()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_schedule public.barber_schedule%rowtype; v_start int; v_end int; v_work_start int; v_duration int; v_clock timestamp;
begin
  if new.status in ('cancelled','no_show') then return new; end if;
  if tg_op='UPDATE' and new.shop_id=old.shop_id and new.barber_id=old.barber_id and new.date=old.date and new.time=old.time
    and new.duration_minutes is not distinct from old.duration_minutes
    and old.status not in ('cancelled','no_show') then return new; end if;

  -- Serialize public and internal reservations for the same professional.
  perform pg_advisory_xact_lock(hashtextextended(new.barber_id::text,0));
  v_duration:=coalesce(new.duration_minutes,30);
  v_start:=(extract(epoch from new.time)/60)::int;
  v_end:=v_start+v_duration;
  if v_duration<=0 or v_end>1440 then raise exception 'Duração inválida para este horário.'; end if;
  if exists(select 1 from public.bookings b where b.id<>new.id and b.barber_id=new.barber_id and b.date=new.date
    and coalesce(b.status,'scheduled') not in ('cancelled','no_show')
    and (extract(epoch from b.time)/60)<v_end and v_start<(extract(epoch from b.time)/60)+coalesce(b.duration_minutes,30))
  then raise exception 'Esse horário acabou de ser reservado. Escolha outro horário.'; end if;

  -- Changing only the duration during a real attendance must not block adding
  -- services because the original start is now in the past.
  if tg_op='UPDATE' and new.shop_id=old.shop_id and new.barber_id=old.barber_id and new.date=old.date and new.time=old.time
    and old.status in ('in_progress','awaiting_payment') then return new; end if;

  v_clock:=clock_timestamp() at time zone 'America/Sao_Paulo';
  if new.date<v_clock::date or (new.date=v_clock::date and new.time<=v_clock::time) then
    raise exception 'Este horário já passou. Escolha um horário disponível.';
  end if;
  select * into v_schedule from public.barber_schedule where barber_id=new.barber_id
    and day_of_week=extract(dow from new.date)::int and is_active;
  if v_schedule.id is null then raise exception 'O profissional não atende neste dia.'; end if;
  v_work_start:=(extract(epoch from v_schedule.start_time)/60)::int;
  if v_start<v_work_start or v_end>(extract(epoch from v_schedule.end_time)/60)::int
    or mod(v_start-v_work_start,15)<>0 or extract(second from new.time)<>0 then
    raise exception 'Escolha um horário disponível dentro da jornada do profissional.';
  end if;
  return new;
end;
$$;
revoke all on function private.enforce_booking_availability() from public,anon,authenticated,service_role;
create trigger bookings_enforce_availability before insert or update of shop_id,barber_id,date,time,duration_minutes,status on public.bookings
for each row execute function private.enforce_booking_availability();

-- Match the public entry point's date validation to the establishment timezone.
CREATE OR REPLACE FUNCTION public.create_public_booking(p_shop_id uuid, p_barber_id uuid, p_client_name text, p_client_phone text, p_date date, p_time time without time zone, p_pet_id uuid DEFAULT NULL::uuid, p_shop_customer_id uuid DEFAULT NULL::uuid, p_duration_minutes integer DEFAULT NULL::integer, p_notes text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_phone TEXT := public.normalize_br_phone(p_client_phone);
  v_name TEXT := trim(COALESCE(p_client_name, ''));
  v_notes TEXT := NULLIF(trim(COALESCE(p_notes, '')), '');
  v_segment TEXT;
  v_booking_id UUID;
  v_duration INT := COALESCE(p_duration_minutes, 30);
  v_new_start INT;
  v_new_end INT;
BEGIN
  IF length(v_name) NOT BETWEEN 2 AND 120 THEN
    RAISE EXCEPTION 'Nome inválido';
  END IF;
  IF v_phone IS NULL OR length(v_phone) NOT BETWEEN 10 AND 11 THEN
    RAISE EXCEPTION 'Telefone inválido';
  END IF;
  IF p_date < (now() at time zone 'America/Sao_Paulo')::date OR p_date > (now() at time zone 'America/Sao_Paulo')::date + 365 THEN
    RAISE EXCEPTION 'Data inválida';
  END IF;
  IF v_duration NOT BETWEEN 15 AND 720 THEN
    RAISE EXCEPTION 'Duração inválida';
  END IF;
  IF v_notes IS NOT NULL AND length(v_notes) > 1000 THEN
    RAISE EXCEPTION 'Observação muito longa';
  END IF;

  SELECT s.segment
  INTO v_segment
  FROM public.shops s
  JOIN public.barbers b ON b.shop_id = s.id
  WHERE s.id = p_shop_id
    AND b.id = p_barber_id
    AND s.subscription_status != 'blocked';

  IF v_segment IS NULL THEN
    RAISE EXCEPTION 'Estabelecimento ou profissional inválido';
  END IF;

  IF (
    SELECT count(*)
    FROM public.bookings b
    WHERE b.shop_id = p_shop_id
      AND public.normalize_br_phone(b.client_phone) = v_phone
      AND b.created_at > now() - interval '10 minutes'
  ) >= 3 THEN
    RAISE EXCEPTION 'Muitas tentativas. Aguarde alguns minutos';
  END IF;

  IF v_segment = 'pet' THEN
    IF p_pet_id IS NULL OR p_shop_customer_id IS NULL THEN
      RAISE EXCEPTION 'Cliente e pet são obrigatórios';
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM public.shop_customers sc
      JOIN public.pets p ON p.customer_id = sc.id AND p.shop_id = sc.shop_id
      WHERE sc.id = p_shop_customer_id
        AND sc.shop_id = p_shop_id
        AND p.id = p_pet_id
        AND public.normalize_br_phone(sc.phone) = v_phone
    ) THEN
      RAISE EXCEPTION 'Cliente ou pet inválido';
    END IF;
  ELSE
    p_pet_id := NULL;
    p_shop_customer_id := NULL;
  END IF;

  v_new_start := (EXTRACT(HOUR FROM p_time)::int * 60) + EXTRACT(MINUTE FROM p_time)::int;
  v_new_end := v_new_start + v_duration;

  IF EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.barber_id = p_barber_id
      AND b.date = p_date
      AND b.status NOT IN ('cancelled', 'no_show')
      AND (
        ((EXTRACT(HOUR FROM b.time)::int * 60) + EXTRACT(MINUTE FROM b.time)::int)
          < v_new_end
        AND v_new_start < (
          ((EXTRACT(HOUR FROM b.time)::int * 60) + EXTRACT(MINUTE FROM b.time)::int)
          + COALESCE(b.duration_minutes, 30)
        )
      )
  ) THEN
    RAISE EXCEPTION 'Esse horário acabou de ser reservado. Escolha outro horário.';
  END IF;

  INSERT INTO public.bookings (
    shop_id, barber_id, client_id, client_name, client_phone, date, time,
    pet_id, shop_customer_id, duration_minutes, notes, status
  ) VALUES (
    p_shop_id, p_barber_id, auth.uid(), v_name, v_phone, p_date, p_time,
    p_pet_id, p_shop_customer_id, v_duration, v_notes, 'scheduled'
  )
  RETURNING id INTO v_booking_id;

  RETURN v_booking_id;
END;
$function$;
