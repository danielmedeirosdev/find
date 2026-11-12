-- Existing rows deliberately retain NULL: their actual payment date is unknown.
ALTER TABLE public.financial_transactions ADD COLUMN paid_on date;
ALTER TABLE public.financial_transactions ALTER COLUMN paid_on SET DEFAULT ((now() AT TIME ZONE 'America/Sao_Paulo')::date);
CREATE TABLE public.payment_date_history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 transaction_id uuid NOT NULL REFERENCES public.financial_transactions(id),
 shop_id uuid NOT NULL REFERENCES public.shops(id),
 previous_date date, new_date date, changed_by uuid, reason text NOT NULL,
 changed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_date_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_read ON public.payment_date_history FOR SELECT TO authenticated USING (public.is_shop_owner(shop_id));
GRANT SELECT ON public.payment_date_history TO authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.payment_date_history FROM authenticated,anon;
CREATE FUNCTION public.audit_payment_date() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP='INSERT' OR NEW.paid_on IS DISTINCT FROM OLD.paid_on THEN
  IF NEW.paid_on > (now() AT TIME ZONE 'America/Sao_Paulo')::date THEN RAISE EXCEPTION 'Data de pagamento futura não permitida'; END IF;
  INSERT INTO payment_date_history(transaction_id,shop_id,previous_date,new_date,changed_by,reason)
  VALUES(NEW.id,NEW.shop_id,CASE WHEN TG_OP='UPDATE' THEN OLD.paid_on ELSE NULL END,NEW.paid_on,auth.uid(),
   CASE WHEN TG_OP='INSERT' THEN 'Registro do recebimento' ELSE coalesce(nullif(current_setting('onefind.payment_date_reason',true),''),'Correção da data') END);
 END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.audit_payment_date() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER payment_date_audit AFTER INSERT OR UPDATE OF paid_on ON public.financial_transactions FOR EACH ROW EXECUTE FUNCTION public.audit_payment_date();
CREATE FUNCTION public.correct_payment_date(p_transaction_id uuid,p_paid_on date,p_reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t financial_transactions%rowtype;
BEGIN
 SELECT * INTO t FROM financial_transactions WHERE id=p_transaction_id FOR UPDATE;
 IF auth.uid() IS NULL OR t.id IS NULL OR NOT is_shop_owner(t.shop_id) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
 IF p_paid_on IS NULL OR p_paid_on > (now() AT TIME ZONE 'America/Sao_Paulo')::date OR length(trim(coalesce(p_reason,'')))<3 THEN RAISE EXCEPTION 'Informe a data real e o motivo da correção'; END IF;
 PERFORM set_config('onefind.payment_date_reason',trim(p_reason),true);
 UPDATE financial_transactions SET paid_on=p_paid_on WHERE id=t.id;
END; $$;
REVOKE ALL ON FUNCTION public.correct_payment_date(uuid,date,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.correct_payment_date(uuid,date,text) TO authenticated;
CREATE FUNCTION public.receive_booking_payment_dated(p_booking_id uuid,p_amount numeric,p_method text,p_request_id uuid,p_paid_on date) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE existing financial_transactions%rowtype; was_existing boolean;
BEGIN
 IF p_paid_on IS NULL OR p_paid_on > (now() AT TIME ZONE 'America/Sao_Paulo')::date THEN RAISE EXCEPTION 'Informe uma data válida'; END IF;
 PERFORM 1 FROM bookings WHERE id=p_booking_id FOR UPDATE;
 SELECT EXISTS(SELECT 1 FROM financial_transactions WHERE payment_request_id=p_request_id) INTO was_existing;
 -- Original RPC retains tenant checks, row locks, balance validation and idempotency.
 PERFORM public.receive_booking_payment(p_booking_id,p_amount,p_method,p_request_id);
 SELECT * INTO existing FROM financial_transactions WHERE payment_request_id=p_request_id FOR UPDATE;
 IF existing.booking_id IS DISTINCT FROM p_booking_id OR NOT is_shop_owner(existing.shop_id) THEN RAISE EXCEPTION 'Operação já utilizada'; END IF;
 IF existing.paid_on IS DISTINCT FROM p_paid_on THEN
  -- Only newly inserted rows can receive the requested date; retries cannot rewrite history.
  IF was_existing THEN RAISE EXCEPTION 'Pagamento já registrado; corrija a data pelo financeiro'; END IF;
  PERFORM set_config('onefind.payment_date_reason','Data informada no recebimento',true);
  UPDATE financial_transactions SET paid_on=p_paid_on WHERE id=existing.id;
 END IF;
END; $$;
REVOKE ALL ON FUNCTION public.receive_booking_payment_dated(uuid,numeric,text,uuid,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.receive_booking_payment_dated(uuid,numeric,text,uuid,date) TO authenticated;
CREATE FUNCTION public.receive_package_payment_dated(p_package_id uuid,p_total numeric,p_amount numeric,p_method text,p_request_id uuid,p_paid_on date) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE existing financial_transactions%rowtype; was_existing boolean;
BEGIN
 IF p_paid_on IS NULL OR p_paid_on > (now() AT TIME ZONE 'America/Sao_Paulo')::date THEN RAISE EXCEPTION 'Informe uma data válida'; END IF;
 PERFORM 1 FROM customer_packages WHERE id=p_package_id FOR UPDATE;
 SELECT EXISTS(SELECT 1 FROM financial_transactions WHERE payment_request_id=p_request_id) INTO was_existing;
 -- Original RPC retains tenant checks, row locks, balance validation and idempotency.
 PERFORM public.receive_package_payment_with_total(p_package_id,p_total,p_amount,p_method,p_request_id);
 SELECT * INTO existing FROM financial_transactions WHERE payment_request_id=p_request_id FOR UPDATE;
 IF existing.customer_package_id IS DISTINCT FROM p_package_id OR NOT is_shop_owner(existing.shop_id) THEN RAISE EXCEPTION 'Operação já utilizada'; END IF;
 IF existing.paid_on IS DISTINCT FROM p_paid_on THEN
  -- Only newly inserted rows can receive the requested date; retries cannot rewrite history.
  IF was_existing THEN RAISE EXCEPTION 'Pagamento já registrado; corrija a data pelo financeiro'; END IF;
  PERFORM set_config('onefind.payment_date_reason','Data informada no recebimento',true);
  UPDATE financial_transactions SET paid_on=p_paid_on WHERE id=existing.id;
 END IF;
END; $$;
REVOKE ALL ON FUNCTION public.receive_package_payment_dated(uuid,numeric,numeric,text,uuid,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.receive_package_payment_dated(uuid,numeric,numeric,text,uuid,date) TO authenticated;
CREATE VIEW public.financial_receipts WITH (security_invoker=true) AS
SELECT t.*, coalesce(t.paid_on,(t.created_at AT TIME ZONE 'America/Sao_Paulo')::date) AS cash_date,
 coalesce(pc.name,bc.name,b.client_name) AS customer_name,
 coalesce(pp.name,bp.name) AS pet_name,
 coalesce(sp.name,sv.names) AS service_name,
 b.date AS booking_date,
 b.barber_id,
 CASE WHEN t.type<>'entrada' THEN NULL
 WHEN t.customer_package_id IS NOT NULL AND cp.sale_amount IS NOT NULL THEN
 CASE WHEN coalesce((SELECT sum(f.amount) FROM public.financial_transactions f WHERE f.customer_package_id=t.customer_package_id AND f.type='entrada' AND (f.created_at,f.id)<=(t.created_at,t.id)),0)>=cp.sale_amount THEN 'Quitação do pacote' ELSE 'Pagamento parcial' END
 WHEN t.booking_id IS NOT NULL AND b.amount_due IS NOT NULL THEN
 CASE WHEN coalesce((SELECT sum(f.amount) FROM public.financial_transactions f WHERE f.booking_id=t.booking_id AND f.type='entrada' AND (f.created_at,f.id)<=(t.created_at,t.id)),0)>=b.amount_due THEN 'Quitação do atendimento' ELSE 'Pagamento parcial' END END AS payment_status
FROM public.financial_transactions t
LEFT JOIN public.customer_packages cp ON cp.id=t.customer_package_id AND cp.shop_id=t.shop_id
LEFT JOIN public.shop_customers pc ON pc.id=cp.customer_id AND pc.shop_id=t.shop_id
LEFT JOIN public.pets pp ON pp.id=cp.pet_id AND pp.shop_id=t.shop_id
LEFT JOIN public.service_packages sp ON sp.id=cp.package_id AND sp.shop_id=t.shop_id
LEFT JOIN public.bookings b ON b.id=t.booking_id AND b.shop_id=t.shop_id
LEFT JOIN public.shop_customers bc ON bc.id=b.shop_customer_id AND bc.shop_id=t.shop_id
LEFT JOIN public.pets bp ON bp.id=b.pet_id AND bp.shop_id=t.shop_id
LEFT JOIN LATERAL (SELECT string_agg(s.name,' + ' ORDER BY s.name) AS names FROM public.booking_services bs JOIN public.services s ON s.id=bs.service_id WHERE bs.booking_id=b.id) sv ON true;
REVOKE ALL ON public.financial_receipts FROM PUBLIC,anon;
GRANT SELECT ON public.financial_receipts TO authenticated;
