-- Opt-in operational access; no financial policies or roles are changed.
ALTER TABLE public.barbers ADD COLUMN can_manage_operations boolean NOT NULL DEFAULT false;
CREATE FUNCTION public.can_manage_shop_operations(p_shop_id uuid) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 RETURN EXISTS(SELECT 1 FROM public.barbers WHERE shop_id=p_shop_id AND user_id=auth.uid() AND can_manage_operations);
END $$;
REVOKE ALL ON FUNCTION public.can_manage_shop_operations(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_shop_operations(uuid) TO authenticated,anon;

CREATE FUNCTION public.protect_agenda_permission() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF (TG_OP='INSERT' AND NEW.can_manage_operations) OR
    (TG_OP='UPDATE' AND NEW.can_manage_operations IS DISTINCT FROM OLD.can_manage_operations) THEN
   IF NOT public.is_shop_owner(NEW.shop_id) THEN RAISE EXCEPTION 'Somente a proprietária pode alterar esta permissão'; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.protect_agenda_permission() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER protect_agenda_permission BEFORE INSERT OR UPDATE ON public.barbers
FOR EACH ROW EXECUTE FUNCTION public.protect_agenda_permission();

CREATE OR REPLACE FUNCTION public.is_booking_assignee(p_booking_id uuid) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 RETURN EXISTS(SELECT 1 FROM public.bookings b JOIN public.barbers br ON br.shop_id=b.shop_id
 WHERE b.id=p_booking_id AND br.user_id=auth.uid() AND (br.id=b.barber_id OR br.can_manage_operations));
END $$;

DROP POLICY IF EXISTS "staff le booking services" ON public.booking_services;
CREATE POLICY "staff le booking services" ON public.booking_services FOR SELECT TO authenticated
USING(public.is_booking_assignee(booking_id));

-- Patch only the verified permission checks, keeping all booking validation intact.
DO $$
DECLARE definition text; patched text;
BEGIN
 definition:=pg_get_functiondef('public.create_operational_booking(uuid,uuid,uuid,uuid,date,time,uuid[])'::regprocedure);
 IF position('is_shop_owner(p_shop_id)' in definition)=0 THEN RAISE EXCEPTION 'Booking authorization changed; review required'; END IF;
 patched:=replace(definition,'is_shop_owner(p_shop_id)','(is_shop_owner(p_shop_id) or public.can_manage_shop_operations(p_shop_id))');
 EXECUTE patched;
 definition:=pg_get_functiondef('public.edit_booking_reservation(uuid,uuid[],date,time,text,uuid,integer)'::regprocedure);
 IF position('not is_shop_owner(b.shop_id)' in definition)=0 THEN RAISE EXCEPTION 'Reassignment authorization changed; review required'; END IF;
 patched:=replace(definition,'not is_shop_owner(b.shop_id)','not (is_shop_owner(b.shop_id) or public.can_manage_shop_operations(b.shop_id))');
 EXECUTE patched;
END $$;

DO $$
DECLARE t text; guard text;
BEGIN
 FOREACH t IN ARRAY ARRAY['shop_customers','pets','services','service_packages'] LOOP
 EXECUTE format('CREATE POLICY operations_staff_manage ON public.%I FOR ALL TO authenticated USING(public.can_manage_shop_operations(shop_id)) WITH CHECK(public.can_manage_shop_operations(shop_id))',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['service_size_rules','service_pet_transport','service_barbers','service_weekday_discounts','service_custom_fields'] LOOP
 guard:=format('EXISTS(SELECT 1 FROM public.services s WHERE s.id=%I.service_id AND public.can_manage_shop_operations(s.shop_id)',t);
 IF t IN ('service_pet_transport','service_weekday_discounts','service_custom_fields') THEN guard:=guard||format(' AND s.shop_id=%I.shop_id',t); END IF;
 IF t='service_barbers' THEN guard:=guard||' AND EXISTS(SELECT 1 FROM public.barbers br WHERE br.id=service_barbers.barber_id AND br.shop_id=s.shop_id)'; END IF;
 guard:=guard||')';
 EXECUTE format('CREATE POLICY operations_staff_manage ON public.%I FOR ALL TO authenticated USING(%s) WITH CHECK(%s)',t,guard,guard);
 END LOOP;
END $$;
CREATE POLICY operations_staff_options ON public.service_custom_field_options FOR ALL TO authenticated
USING(EXISTS(SELECT 1 FROM public.service_custom_fields f JOIN public.services s ON s.id=f.service_id WHERE f.id=field_id AND s.shop_id=service_custom_field_options.shop_id AND public.can_manage_shop_operations(s.shop_id)))
WITH CHECK(EXISTS(SELECT 1 FROM public.service_custom_fields f JOIN public.services s ON s.id=f.service_id WHERE f.id=field_id AND s.shop_id=service_custom_field_options.shop_id AND public.can_manage_shop_operations(s.shop_id)));
CREATE POLICY operations_staff_read_packages ON public.customer_packages FOR SELECT TO authenticated USING(public.can_manage_shop_operations(shop_id));
CREATE POLICY operations_staff_read_usages ON public.package_usages FOR SELECT TO authenticated
USING(EXISTS(SELECT 1 FROM public.customer_packages cp WHERE cp.id=customer_package_id AND public.can_manage_shop_operations(cp.shop_id)));

CREATE FUNCTION public.update_operational_package(p_id uuid,p_total integer,p_expiry date) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE cp public.customer_packages%rowtype;
BEGIN
 SELECT * INTO cp FROM public.customer_packages WHERE id=p_id FOR UPDATE;
 IF cp.id IS NULL OR NOT (public.is_shop_owner(cp.shop_id) OR public.can_manage_shop_operations(cp.shop_id)) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
 IF p_total IS NULL OR p_total<greatest(1,cp.used_sessions) THEN RAISE EXCEPTION 'Confira o total de sessões'; END IF;
 UPDATE public.customer_packages SET total_sessions=p_total,expires_at=p_expiry,
 status=CASE WHEN cp.status='cancelled' THEN cp.status WHEN cp.used_sessions>=p_total THEN 'exhausted' WHEN p_expiry<current_date THEN 'expired' ELSE 'active' END WHERE id=p_id;
END $$;
REVOKE ALL ON FUNCTION public.update_operational_package(uuid,integer,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.update_operational_package(uuid,integer,date) TO authenticated;

DO $$
DECLARE src text; fn regprocedure;
BEGIN
 fn:='public.save_pet_service_duration(uuid,uuid,text,numeric,integer,jsonb)'::regprocedure;
 src:=pg_get_functiondef(fn);
 IF position('NOT public.is_shop_owner(p_shop_id)' in src)=0 THEN RAISE EXCEPTION 'Service authorization changed'; END IF;
 EXECUTE replace(src,'NOT public.is_shop_owner(p_shop_id)','NOT (public.is_shop_owner(p_shop_id) OR public.can_manage_shop_operations(p_shop_id))');
 fn:='public.sell_customer_package(uuid,uuid,uuid,uuid,uuid,boolean,text)'::regprocedure;
 src:=pg_get_functiondef(fn);
 IF position('NOT is_shop_owner(p_shop_id)' in src)=0 THEN RAISE EXCEPTION 'Package sale authorization changed'; END IF;
 EXECUTE replace(src,'NOT is_shop_owner(p_shop_id)','NOT (is_shop_owner(p_shop_id) OR (public.can_manage_shop_operations(p_shop_id) AND p_paid_now IS FALSE))');
 fn:='public.consume_package_session(uuid,uuid,text)'::regprocedure;
 src:=pg_get_functiondef(fn);
 IF position('is_shop_owner(v_shop_id)' in src)=0 THEN RAISE EXCEPTION 'Package usage authorization changed'; END IF;
 EXECUTE replace(src,'is_shop_owner(v_shop_id)','(is_shop_owner(v_shop_id) OR public.can_manage_shop_operations(v_shop_id))');
 fn:='public.reverse_manual_package_usage(uuid)'::regprocedure;
 src:=pg_get_functiondef(fn);
 IF position('public.is_shop_owner(v_package.shop_id)' in src)=0 THEN RAISE EXCEPTION 'Reversal authorization changed'; END IF;
 EXECUTE replace(src,'public.is_shop_owner(v_package.shop_id)','(public.is_shop_owner(v_package.shop_id) OR public.can_manage_shop_operations(v_package.shop_id))');
END $$;
