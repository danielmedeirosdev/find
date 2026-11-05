-- Keep the original price of the reusable model; adjust only this customer's sale.
CREATE TABLE public.package_price_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id),
  customer_package_id uuid NOT NULL REFERENCES public.customer_packages(id),
  previous_amount numeric(12,2) NOT NULL,
  new_amount numeric(12,2) NOT NULL,
  changed_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.package_price_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY package_price_adjustments_owner_read ON public.package_price_adjustments
  FOR SELECT TO authenticated USING (public.is_shop_owner(shop_id));
REVOKE ALL ON public.package_price_adjustments FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.package_price_adjustments TO authenticated;

CREATE FUNCTION public.receive_package_payment_with_total(
  p_package_id uuid, p_total numeric, p_amount numeric, p_method text, p_request_id uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cp public.customer_packages%rowtype; paid numeric; existing public.financial_transactions%rowtype;
BEGIN
  IF auth.uid() IS NULL OR p_package_id IS NULL THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  SELECT * INTO cp FROM public.customer_packages WHERE id = p_package_id FOR UPDATE;
  IF cp.id IS NULL OR NOT public.is_shop_owner(cp.shop_id) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF p_request_id IS NULL OR p_total IS NULL OR p_total < 0 OR p_total > 999999.99
    OR p_total::text IN ('NaN','Infinity','-Infinity') OR round(p_total,2) <> p_total
    OR p_amount IS NULL OR p_amount <= 0 OR p_amount::text IN ('NaN','Infinity','-Infinity')
    OR round(p_amount,2) <> p_amount OR p_method NOT IN ('pix','cartao','dinheiro') THEN
    RAISE EXCEPTION 'Confira o total e o valor recebido';
  END IF;
  SELECT * INTO existing FROM public.financial_transactions WHERE payment_request_id = p_request_id;
  IF existing.id IS NOT NULL THEN
    IF existing.customer_package_id IS DISTINCT FROM cp.id OR existing.amount <> p_amount
      OR existing.payment_method <> p_method THEN RAISE EXCEPTION 'Operação já utilizada'; END IF;
    RETURN;
  END IF;
  IF cp.sale_amount IS NULL THEN RAISE EXCEPTION 'Pacote antigo sem cobrança definida'; END IF;
  SELECT coalesce(sum(amount),0) INTO paid FROM public.financial_transactions
    WHERE customer_package_id = cp.id AND type = 'entrada';
  IF p_total < paid + p_amount THEN RAISE EXCEPTION 'O total não pode ser menor que o valor já recebido'; END IF;
  IF p_total <> cp.sale_amount THEN
    UPDATE public.customer_packages SET sale_amount = p_total WHERE id = cp.id;
    INSERT INTO public.package_price_adjustments
      (shop_id,customer_package_id,previous_amount,new_amount,changed_by)
      VALUES (cp.shop_id,cp.id,cp.sale_amount,p_total,auth.uid());
  END IF;
  PERFORM public.receive_package_payment(p_package_id,p_amount,p_method,p_request_id);
END; $$;
REVOKE ALL ON FUNCTION public.receive_package_payment_with_total(uuid,numeric,numeric,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.receive_package_payment_with_total(uuid,numeric,numeric,text,uuid) TO authenticated;

-- Preserve the service price that one package session covers when extras are added
-- before closeout. Existing completed appointments and package usages are untouched.
ALTER TABLE public.bookings ADD COLUMN package_base_services_amount numeric(12,2)
  CHECK (package_base_services_amount >= 0);
DO $$
DECLARE definition text; patched text;
BEGIN
  definition := pg_get_functiondef('public.edit_booking_reservation(uuid,uuid[],date,time without time zone,text,uuid,integer)'::regprocedure);
  IF position('notes=p_notes,services_amount=v_amount,' IN definition) = 0 THEN
    RAISE EXCEPTION 'edit_booking_reservation changed; review required';
  END IF;
  patched := replace(definition,
    'notes=p_notes,services_amount=v_amount,',
    'notes=p_notes,services_amount=v_amount,package_base_services_amount=case when b.status in (''in_progress'',''awaiting_payment'') and v_added>0 then coalesce(b.package_base_services_amount,b.services_amount) else b.package_base_services_amount end,');
  EXECUTE patched;

  definition := pg_get_functiondef('public.complete_booking_payment(uuid,uuid[],text,numeric,uuid,boolean,numeric,integer)'::regprocedure);
  IF position('coalesce(v_booking.services_amount,0)' IN definition) = 0 THEN
    RAISE EXCEPTION 'complete_booking_payment changed; review required';
  END IF;
  patched := replace(definition,
    'coalesce(v_booking.services_amount,0)',
    'coalesce(v_booking.package_base_services_amount,v_booking.services_amount,0)');
  EXECUTE patched;
END $$;
