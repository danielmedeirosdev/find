-- Assigned staff may consume a package only through their matching booking.
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

  IF NOT (is_shop_owner(v_shop_id) OR (p_booking_id IS NOT NULL AND is_booking_assignee(p_booking_id))) THEN
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

