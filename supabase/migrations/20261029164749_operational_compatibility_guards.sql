-- Keep older clients on the same transactional reservation/payment rules.
CREATE OR REPLACE FUNCTION public.complete_booking(p_booking_id uuid,p_service_ids uuid[],p_payment_method text,p_amount numeric,p_customer_package_id uuid DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM complete_booking_payment(p_booking_id,p_service_ids,p_payment_method,p_amount,p_customer_package_id,true,NULL,NULL);
END;$$;
CREATE OR REPLACE FUNCTION public.edit_operational_booking(p_booking_id uuid,p_service_ids uuid[],p_date date,p_time time,p_notes text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM edit_booking_reservation(p_booking_id,p_service_ids,p_date,p_time,p_notes,NULL,NULL);
END;$$;
CREATE OR REPLACE FUNCTION public.edit_operational_booking_professional(p_booking_id uuid,p_service_ids uuid[],p_date date,p_time time,p_notes text DEFAULT NULL,p_barber_id uuid DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM edit_booking_reservation(p_booking_id,p_service_ids,p_date,p_time,p_notes,p_barber_id,NULL);
END;$$;
DO $$ DECLARE src text; updated text; BEGIN
 src:=pg_get_functiondef('public.refresh_booking_durations(uuid,jsonb)'::regprocedure);
 updated:=replace(src,'OR b.historical_entry THEN','OR b.historical_entry OR (b.date+b.time)<=(now() at time zone ''America/Sao_Paulo'') THEN');
 IF src=updated THEN RAISE EXCEPTION 'Duration refresh definition changed';END IF;
 EXECUTE updated;
END $$;
