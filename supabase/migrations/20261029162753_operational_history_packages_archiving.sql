-- Additive operational history. Existing package balances are not inferred.
ALTER TABLE public.bookings ADD COLUMN archived_at timestamptz;
ALTER TABLE public.bookings ADD COLUMN archived_by uuid REFERENCES auth.users(id);
ALTER TABLE public.bookings ADD COLUMN historical_entry boolean NOT NULL DEFAULT false;
ALTER TABLE public.customer_packages ADD COLUMN sale_amount numeric(12,2) CHECK(sale_amount>=0);
ALTER TABLE public.customer_packages ADD COLUMN sold_at timestamptz;
ALTER TABLE public.financial_transactions ADD COLUMN customer_package_id uuid REFERENCES public.customer_packages(id);
CREATE TABLE public.booking_management_audit(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),shop_id uuid NOT NULL REFERENCES public.shops(id),actor_id uuid NOT NULL,action text NOT NULL,booking_ids uuid[] NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.booking_management_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_read_management_audit ON public.booking_management_audit FOR SELECT TO authenticated USING(public.is_shop_owner(shop_id));
REVOKE ALL ON public.booking_management_audit FROM anon,authenticated;
GRANT SELECT ON public.booking_management_audit TO authenticated;
DROP INDEX public.bookings_active_slot_uidx;
CREATE UNIQUE INDEX bookings_active_slot_uidx ON public.bookings(barber_id,date,time) WHERE status NOT IN ('cancelled','no_show') AND archived_at IS NULL AND NOT historical_entry;
CREATE OR REPLACE VIEW public.public_booking_slots AS SELECT shop_id,barber_id,date,time,coalesce(duration_minutes,30) duration_minutes FROM public.bookings WHERE status IN ('scheduled','confirmed','in_progress','awaiting_payment','completed') AND date>=current_date AND archived_at IS NULL AND NOT historical_entry;

CREATE FUNCTION public.manage_booking_archive(p_shop_id uuid,p_ids uuid[],p_restore boolean DEFAULT false) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b bookings%rowtype; n integer; ids uuid[];
BEGIN
 IF auth.uid() IS NULL OR NOT is_shop_owner(p_shop_id) THEN RAISE EXCEPTION 'Somente o responsável pode gerenciar agendamentos';END IF;
 SELECT array_agg(DISTINCT id) INTO ids FROM unnest(p_ids) id;
 IF coalesce(cardinality(ids),0)=0 OR cardinality(ids)>500 THEN RAISE EXCEPTION 'Selecione entre 1 e 500 atendimentos';END IF;
 PERFORM id FROM bookings WHERE id=ANY(ids) ORDER BY id FOR UPDATE;
 SELECT count(*) INTO n FROM bookings WHERE id=ANY(ids) AND shop_id=p_shop_id;
 IF n<>cardinality(ids) THEN RAISE EXCEPTION 'Seleção inválida';END IF;
 IF p_restore THEN
  FOR b IN SELECT * FROM bookings WHERE id=ANY(ids) AND archived_at IS NOT NULL ORDER BY barber_id,date,time LOOP
   PERFORM pg_advisory_xact_lock(hashtextextended(b.barber_id::text,0));
   IF b.status NOT IN ('cancelled','no_show') AND NOT b.historical_entry AND EXISTS(SELECT 1 FROM bookings x WHERE x.id<>b.id AND x.barber_id=b.barber_id AND x.date=b.date AND x.archived_at IS NULL AND NOT x.historical_entry AND x.status NOT IN ('cancelled','no_show') AND b.time<x.time+make_interval(mins=>coalesce(x.duration_minutes,30)) AND x.time<b.time+make_interval(mins=>coalesce(b.duration_minutes,30))) THEN RAISE EXCEPTION 'Há conflito ao recuperar. Nenhum registro foi recuperado.';END IF;
   UPDATE bookings SET archived_at=NULL,archived_by=NULL WHERE id=b.id;
  END LOOP;
 ELSE
  UPDATE bookings SET archived_at=now(),archived_by=auth.uid() WHERE id=ANY(ids) AND archived_at IS NULL;
 END IF;
 INSERT INTO booking_management_audit(shop_id,actor_id,action,booking_ids) VALUES(p_shop_id,auth.uid(),CASE WHEN p_restore THEN 'restore' ELSE 'archive' END,ids);
 RETURN n;
END;$$;
REVOKE ALL ON FUNCTION public.manage_booking_archive(uuid,uuid[],boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.manage_booking_archive(uuid,uuid[],boolean) TO authenticated;

CREATE FUNCTION public.receive_package_payment(p_package_id uuid,p_amount numeric,p_method text,p_request_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE cp customer_packages%rowtype; paid numeric; existing financial_transactions%rowtype;
BEGIN
 SELECT * INTO cp FROM customer_packages WHERE id=p_package_id FOR UPDATE;
 IF auth.uid() IS NULL OR cp.id IS NULL OR NOT is_shop_owner(cp.shop_id) THEN RAISE EXCEPTION 'Sem permissão';END IF;
 IF p_request_id IS NULL OR p_amount IS NULL OR p_amount<=0 OR p_amount::text IN ('NaN','Infinity','-Infinity') OR round(p_amount,2)<>p_amount OR p_method IS NULL OR p_method NOT IN ('pix','cartao','dinheiro') THEN RAISE EXCEPTION 'Pagamento inválido';END IF;
 SELECT * INTO existing FROM financial_transactions WHERE payment_request_id=p_request_id;
 IF existing.id IS NOT NULL THEN
  IF existing.customer_package_id IS DISTINCT FROM cp.id OR existing.amount<>p_amount OR existing.payment_method<>p_method THEN RAISE EXCEPTION 'Operação já utilizada';END IF;RETURN;
 END IF;
 SELECT coalesce(sum(amount),0) INTO paid FROM financial_transactions WHERE customer_package_id=cp.id AND type='entrada';
 IF cp.sale_amount IS NULL OR p_amount>cp.sale_amount-paid THEN RAISE EXCEPTION 'Valor maior que o saldo ou pacote antigo sem cobrança definida';END IF;
 INSERT INTO financial_transactions(shop_id,customer_package_id,type,description,amount,payment_method,payment_request_id) VALUES(cp.shop_id,cp.id,'entrada','Recebimento de pacote',p_amount,p_method,p_request_id);
END;$$;
REVOKE ALL ON FUNCTION public.receive_package_payment(uuid,numeric,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.receive_package_payment(uuid,numeric,text,uuid) TO authenticated;

CREATE FUNCTION public.sell_customer_package(p_id uuid,p_shop_id uuid,p_template_id uuid,p_customer_id uuid,p_pet_id uuid,p_paid_now boolean,p_method text DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t service_packages%rowtype; cp customer_packages%rowtype;
BEGIN
 IF auth.uid() IS NULL OR NOT is_shop_owner(p_shop_id) THEN RAISE EXCEPTION 'Sem permissão';END IF;
 IF p_id IS NULL OR p_paid_now IS NULL THEN RAISE EXCEPTION 'Venda inválida';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 SELECT * INTO cp FROM customer_packages WHERE id=p_id;
 IF cp.id IS NOT NULL THEN
  IF cp.shop_id<>p_shop_id OR cp.package_id<>p_template_id OR cp.customer_id<>p_customer_id OR cp.pet_id<>p_pet_id THEN RAISE EXCEPTION 'Operação já utilizada';END IF;RETURN cp.id;
 END IF;
 SELECT * INTO t FROM service_packages WHERE id=p_template_id AND shop_id=p_shop_id AND active;
 IF t.id IS NULL OR NOT EXISTS(SELECT 1 FROM pets WHERE id=p_pet_id AND shop_id=p_shop_id AND customer_id=p_customer_id) THEN RAISE EXCEPTION 'Confira pacote, cliente e pet';END IF;
 INSERT INTO customer_packages(id,shop_id,package_id,customer_id,pet_id,total_sessions,used_sessions,expires_at,status,sale_amount,sold_at)
 VALUES(p_id,p_shop_id,t.id,p_customer_id,p_pet_id,t.total_sessions,0,CASE WHEN t.validity_days IS NULL THEN NULL ELSE current_date+t.validity_days END,'active',t.price,now());
 IF p_paid_now AND t.price>0 THEN PERFORM receive_package_payment(p_id,t.price,p_method,p_id);END IF;
 RETURN p_id;
END;$$;
REVOKE ALL ON FUNCTION public.sell_customer_package(uuid,uuid,uuid,uuid,uuid,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sell_customer_package(uuid,uuid,uuid,uuid,uuid,boolean,text) TO authenticated;

CREATE FUNCTION public.package_balances(p_shop_id uuid) RETURNS TABLE(package_id uuid,total numeric,received numeric,balance numeric) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT is_shop_owner(p_shop_id) THEN RAISE EXCEPTION 'Sem permissão';END IF;
 RETURN QUERY SELECT cp.id,cp.sale_amount,coalesce(t.paid,0),greatest(cp.sale_amount-coalesce(t.paid,0),0) FROM customer_packages cp LEFT JOIN LATERAL(SELECT sum(amount) paid FROM financial_transactions WHERE customer_package_id=cp.id AND type='entrada') t ON true WHERE cp.shop_id=p_shop_id AND cp.sale_amount IS NOT NULL;
END;$$;
REVOKE ALL ON FUNCTION public.package_balances(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.package_balances(uuid) TO authenticated;

-- Update only the known overlap queries; fail if the expected definitions changed.
DO $$ DECLARE fn regprocedure; src text; updated text; BEGIN
 FOREACH fn IN ARRAY ARRAY['public.create_public_booking(uuid,uuid,text,text,date,time,uuid,uuid,integer,text)'::regprocedure,'public.create_operational_booking(uuid,uuid,uuid,uuid,date,time,uuid[])'::regprocedure,'public.edit_operational_booking(uuid,uuid[],date,time,text)'::regprocedure,'public.edit_operational_booking_professional(uuid,uuid[],date,time,text,uuid)'::regprocedure,'public.edit_booking_reservation(uuid,uuid[],date,time,text,uuid,integer)'::regprocedure,'private.enforce_booking_availability()'::regprocedure] LOOP
  src:=pg_get_functiondef(fn);
  updated:=regexp_replace(src,'(from (public\.)?bookings ([bx])\s+where )([bx]\.(barber_id|id))','\1\3.archived_at is null and not \3.historical_entry and \4','gi');
  IF updated=src THEN RAISE EXCEPTION 'Overlap function changed: %',fn; END IF;
  EXECUTE updated;
 END LOOP;
END $$;
-- Historical entries describe work already performed and do not reserve capacity.
DO $$ DECLARE fn regprocedure; src text; guard text; BEGIN
 guard:=' IF NEW.historical_entry THEN
 IF auth.uid() IS NULL OR NOT (public.is_shop_owner(NEW.shop_id) OR public.is_booking_assignee(NEW.id) OR (public.is_shop_staff(NEW.shop_id) AND public.staff_barber_id(NEW.shop_id)=NEW.barber_id)) OR NEW.date>(now() at time zone ''America/Sao_Paulo'')::date OR (NEW.date=(now() at time zone ''America/Sao_Paulo'')::date AND NEW.time>(now() at time zone ''America/Sao_Paulo'')::time) THEN RAISE EXCEPTION ''Registro retroativo inválido''; END IF; RETURN NEW; END IF; ';
 FOREACH fn IN ARRAY ARRAY['private.enforce_booking_availability()'::regprocedure,'private.reject_booking_during_shop_closure()'::regprocedure,'private.reject_booking_during_time_off()'::regprocedure] LOOP
  src:=pg_get_functiondef(fn);
  EXECUTE regexp_replace(src,'\mBEGIN\M','BEGIN '||guard,'i');
 END LOOP;
END $$;

CREATE FUNCTION public.record_historical_booking(p_id uuid,p_shop_id uuid,p_barber_id uuid,p_customer_id uuid,p_pet_id uuid,p_date date,p_time time,p_service_ids uuid[],p_paid_now boolean,p_method text DEFAULT NULL,p_package_id uuid DEFAULT NULL,p_extra_service_ids uuid[] DEFAULT '{}') RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c shop_customers%rowtype; b bookings%rowtype; total numeric; due numeric; duration integer; all_ids uuid[];
BEGIN
 IF auth.uid() IS NULL OR NOT (is_shop_owner(p_shop_id) OR (is_shop_staff(p_shop_id) AND staff_barber_id(p_shop_id)=p_barber_id)) THEN RAISE EXCEPTION 'Sem permissão';END IF;
 IF p_id IS NULL OR p_date IS NULL OR p_time IS NULL OR p_paid_now IS NULL OR p_date+p_time>(now() at time zone 'America/Sao_Paulo') THEN RAISE EXCEPTION 'Informe a data e horário já realizados';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 SELECT * INTO b FROM bookings WHERE id=p_id;
 IF b.id IS NOT NULL THEN
  IF b.shop_id<>p_shop_id OR b.barber_id<>p_barber_id OR b.shop_customer_id<>p_customer_id OR b.pet_id<>p_pet_id OR b.date<>p_date OR b.time<>p_time OR NOT b.historical_entry THEN RAISE EXCEPTION 'Operação já utilizada';END IF;RETURN b.id;
 END IF;
 SELECT * INTO c FROM shop_customers WHERE id=p_customer_id AND shop_id=p_shop_id;
 IF c.id IS NULL OR NOT EXISTS(SELECT 1 FROM pets WHERE id=p_pet_id AND customer_id=c.id AND shop_id=p_shop_id) OR NOT EXISTS(SELECT 1 FROM barbers WHERE id=p_barber_id AND shop_id=p_shop_id) THEN RAISE EXCEPTION 'Cliente, pet ou profissional inválido';END IF;
 all_ids:=p_service_ids||coalesce(p_extra_service_ids,'{}');
 IF coalesce(cardinality(p_service_ids),0)=0 OR EXISTS(SELECT 1 FROM unnest(all_ids) sid WHERE NOT EXISTS(SELECT 1 FROM services WHERE id=sid AND shop_id=p_shop_id)) THEN RAISE EXCEPTION 'Serviços inválidos';END IF;
 SELECT sum(round(coalesce(r.price,s.price)*(1-coalesce(w.discount_percent,0)/100),2)),sum(coalesce(r.duration_minutes,s.duration_minutes)) INTO total,duration FROM services s LEFT JOIN pets p ON p.id=p_pet_id LEFT JOIN service_size_rules r ON r.service_id=s.id AND r.size=p.size LEFT JOIN service_weekday_discounts w ON w.service_id=s.id AND w.day_of_week=extract(dow from p_date) WHERE s.id=ANY(p_service_ids);
 INSERT INTO bookings(id,shop_id,barber_id,shop_customer_id,pet_id,client_name,client_phone,date,time,duration_minutes,services_amount,quoted_amount,status,historical_entry) VALUES(p_id,p_shop_id,p_barber_id,c.id,p_pet_id,c.name,c.phone,p_date,p_time,duration,total,total,'awaiting_payment',true);
 INSERT INTO booking_services(booking_id,service_id) SELECT p_id,id FROM services WHERE id=ANY(p_service_ids);
 SELECT coalesce(sum(round(coalesce(r.price,s.price)*(1-coalesce(w.discount_percent,0)/100),2)),0) INTO due FROM services s LEFT JOIN pets p ON p.id=p_pet_id LEFT JOIN service_size_rules r ON r.service_id=s.id AND r.size=p.size LEFT JOIN service_weekday_discounts w ON w.service_id=s.id AND w.day_of_week=extract(dow from p_date) WHERE s.id=ANY(coalesce(p_extra_service_ids,'{}')) AND NOT s.id=ANY(p_service_ids);
 due:=due+CASE WHEN p_package_id IS NULL THEN total ELSE 0 END;
 PERFORM complete_booking_payment(p_id,all_ids,p_method,due,p_package_id,p_paid_now,NULL,duration);
 UPDATE bookings SET completed_at=(p_date+p_time) at time zone 'America/Sao_Paulo' WHERE id=p_id;
 RETURN p_id;
END;$$;
REVOKE ALL ON FUNCTION public.record_historical_booking(uuid,uuid,uuid,uuid,uuid,date,time,uuid[],boolean,text,uuid,uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.record_historical_booking(uuid,uuid,uuid,uuid,uuid,date,time,uuid[],boolean,text,uuid,uuid[]) TO authenticated;

CREATE FUNCTION public.refresh_booking_durations(p_shop_id uuid,p_items jsonb) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE item jsonb; b bookings%rowtype; minutes integer; ids uuid[]; n integer:=0;
BEGIN
 IF auth.uid() IS NULL OR NOT is_shop_owner(p_shop_id) THEN RAISE EXCEPTION 'Somente o responsável pode atualizar durações';END IF;
 IF jsonb_typeof(p_items)<>'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Seleção inválida';END IF;
 PERFORM id FROM bookings WHERE id IN (SELECT (x->>'id')::uuid FROM jsonb_array_elements(p_items) x) ORDER BY id FOR UPDATE;
 FOR item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
  SELECT * INTO b FROM bookings WHERE id=(item->>'id')::uuid;
  IF b.id IS NULL OR b.shop_id<>p_shop_id OR b.status NOT IN ('scheduled','confirmed') OR b.archived_at IS NOT NULL OR b.historical_entry THEN RAISE EXCEPTION 'Selecione apenas reservas futuras ativas';END IF;
  IF b.duration_minutes IS DISTINCT FROM (item->>'before')::integer OR b.date::text IS DISTINCT FROM item->>'date' OR b.time::text IS DISTINCT FROM item->>'time' OR b.barber_id::text IS DISTINCT FROM item->>'barber_id' THEN RAISE EXCEPTION 'Um atendimento mudou. Confira novamente a prévia.';END IF;
  SELECT array_agg(s.id),sum(coalesce(r.duration_minutes,s.duration_minutes)) INTO ids,minutes FROM booking_services bs JOIN services s ON s.id=bs.service_id LEFT JOIN pets p ON p.id=b.pet_id LEFT JOIN service_size_rules r ON r.service_id=s.id AND r.size=p.size WHERE bs.booking_id=b.id;
  IF minutes IS DISTINCT FROM (item->>'after')::integer THEN RAISE EXCEPTION 'A duração dos serviços mudou. Atualize a prévia.';END IF;
  PERFORM edit_booking_reservation(b.id,ids,b.date,b.time,b.notes,NULL,minutes);n:=n+1;
 END LOOP;
 INSERT INTO booking_management_audit(shop_id,actor_id,action,booking_ids) SELECT p_shop_id,auth.uid(),'refresh_duration',array_agg((x->>'id')::uuid) FROM jsonb_array_elements(p_items) x;
 RETURN n;
END;$$;
REVOKE ALL ON FUNCTION public.refresh_booking_durations(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.refresh_booking_durations(uuid,jsonb) TO authenticated;

DO $$ DECLARE fn regprocedure; src text; updated text; BEGIN
 FOREACH fn IN ARRAY ARRAY['private.process_confirmation_reminders(uuid)'::regprocedure,'public.get_pending_confirmation_reminders(uuid)'::regprocedure] LOOP
  src:=pg_get_functiondef(fn);
  updated:=replace(src,'coalesce(b.status,','b.archived_at is null and not b.historical_entry and coalesce(b.status,');
  IF src=updated THEN RAISE EXCEPTION 'Reminder definition changed: %',fn;END IF;
  EXECUTE updated;
 END LOOP;
END $$;
CREATE FUNCTION private.protect_archived_booking() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF OLD.archived_at IS NOT NULL AND NEW.archived_at IS NOT NULL AND (NEW.status IS DISTINCT FROM OLD.status OR NEW.date IS DISTINCT FROM OLD.date OR NEW.time IS DISTINCT FROM OLD.time OR NEW.barber_id IS DISTINCT FROM OLD.barber_id OR NEW.duration_minutes IS DISTINCT FROM OLD.duration_minutes) THEN RAISE EXCEPTION 'Recupere o atendimento antes de alterar sua reserva ou situação';END IF;
 RETURN NEW;
END;$$;
CREATE TRIGGER protect_archived_booking BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION private.protect_archived_booking();
REVOKE ALL ON FUNCTION private.protect_archived_booking() FROM PUBLIC,anon,authenticated;
