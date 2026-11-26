ALTER TABLE public.initial_setup ADD COLUMN drafts jsonb NOT NULL DEFAULT '{}';
CREATE TABLE private.setup_saves(request_id uuid PRIMARY KEY,shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,result jsonb NOT NULL);
ALTER TABLE private.setup_saves ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.setup_saves FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.save_initial_setup_draft(p_shop uuid,p_step integer,p_draft jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
IF NOT public.is_shop_owner(p_shop) OR p_step NOT BETWEEN 1 AND 6 OR jsonb_typeof(p_draft)<>'object' OR octet_length(p_draft::text)>20000 THEN RAISE EXCEPTION 'Rascunho inválido';END IF;
UPDATE public.initial_setup SET drafts=jsonb_set(drafts,ARRAY[p_step::text],p_draft),updated_at=now() WHERE shop_id=p_shop AND mode='self' AND status IN('active','deferred');
IF NOT FOUND THEN RAISE EXCEPTION 'Configuração indisponível';END IF;END $$;
CREATE FUNCTION public.save_initial_setup_step(p_shop uuid,p_step integer,p_request uuid,p_data jsonb,p_advance boolean DEFAULT true) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE st public.initial_setup; result jsonb; entity uuid; customer uuid; price numeric; sessions integer;BEGIN
IF NOT public.is_shop_owner(p_shop) THEN RAISE EXCEPTION 'Sem permissão';END IF;
SELECT * INTO st FROM public.initial_setup WHERE shop_id=p_shop FOR UPDATE;
SELECT s.result INTO result FROM private.setup_saves s WHERE s.request_id=p_request AND s.shop_id=p_shop;
IF result IS NOT NULL THEN RETURN result;END IF;
IF st.shop_id IS NULL OR st.mode<>'self' OR st.status<>'active' OR st.step<>p_step THEN RAISE EXCEPTION 'Atualize o progresso antes de continuar';END IF;
IF p_request IS NULL OR jsonb_typeof(p_data)<>'object' OR octet_length(p_data::text)>20000 THEN RAISE EXCEPTION 'Dados inválidos';END IF;
CASE p_step
WHEN 1 THEN
 IF length(btrim(coalesce(p_data->>'name',''))) NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'Informe o nome da loja';END IF;
 UPDATE public.shops SET name=btrim(p_data->>'name'),address=nullif(btrim(p_data->>'address'),''),slogan=nullif(btrim(p_data->>'slogan'),'') WHERE id=p_shop;
WHEN 2 THEN
 IF nullif(btrim(p_data->>'name'),'') IS NULL AND nullif(btrim(p_data->>'role'),'') IS NOT NULL THEN RAISE EXCEPTION 'Informe o nome de quem realiza os atendimentos';END IF;
 IF nullif(btrim(p_data->>'name'),'') IS NOT NULL THEN INSERT INTO public.barbers(shop_id,name,role) VALUES(p_shop,btrim(p_data->>'name'),nullif(btrim(p_data->>'role'),'')) RETURNING id INTO entity;
 ELSIF NOT EXISTS(SELECT 1 FROM public.barbers WHERE shop_id=p_shop) THEN RAISE EXCEPTION 'Informe quem realiza os atendimentos ou pule esta etapa';END IF;
WHEN 3 THEN
 IF NOT EXISTS(SELECT 1 FROM public.barber_schedule bs JOIN public.barbers b ON b.id=bs.barber_id WHERE b.shop_id=p_shop AND bs.is_active AND bs.start_time<bs.end_time) THEN RAISE EXCEPTION 'Defina os horários de atendimento ou pule esta etapa';END IF;
WHEN 4 THEN
 IF nullif(btrim(p_data->>'name'),'') IS NULL AND nullif(p_data->>'price','') IS NOT NULL THEN RAISE EXCEPTION 'Informe o nome do serviço';END IF;
 IF nullif(btrim(p_data->>'name'),'') IS NULL THEN
 IF NOT EXISTS(SELECT 1 FROM public.services WHERE shop_id=p_shop) THEN RAISE EXCEPTION 'Cadastre um serviço ou pule esta etapa';END IF;
 ELSE
 IF nullif(p_data->>'price','') IS NULL THEN RAISE EXCEPTION 'Informe o preço';END IF;
 entity:=public.save_pet_service_duration(p_shop,NULL,btrim(p_data->>'name'),(replace(p_data->>'price',',','.'))::numeric,(p_data->>'duration_minutes')::integer,p_data->'size_durations');
 END IF;
WHEN 5 THEN
 IF nullif(btrim(p_data->>'pet_name'),'') IS NULL AND (nullif(btrim(p_data->>'customer_name'),'') IS NOT NULL OR nullif(p_data->>'customer_phone','') IS NOT NULL) THEN RAISE EXCEPTION 'Informe o nome do pet';END IF;
 IF nullif(btrim(p_data->>'pet_name'),'') IS NULL THEN
 IF NOT EXISTS(SELECT 1 FROM public.pets WHERE shop_id=p_shop) THEN RAISE EXCEPTION 'Informe o pet e seu responsável ou pule esta etapa';END IF;
 ELSE
 IF nullif(p_data->>'customer_id','') IS NOT NULL THEN
 SELECT id INTO customer FROM public.shop_customers WHERE shop_id=p_shop AND id=(p_data->>'customer_id')::uuid;
 IF customer IS NULL THEN RAISE EXCEPTION 'Cliente inválido';END IF;
 ELSE
 IF nullif(btrim(p_data->>'customer_name'),'') IS NULL OR regexp_replace(coalesce(p_data->>'customer_phone',''),'[^0-9]','','g') !~ '^[0-9]{10,11}$' THEN RAISE EXCEPTION 'Informe nome e telefone com DDD do responsável';END IF;
 SELECT id INTO customer FROM public.shop_customers WHERE shop_id=p_shop AND phone=regexp_replace(p_data->>'customer_phone','[^0-9]','','g');
 IF customer IS NULL THEN INSERT INTO public.shop_customers(shop_id,name,phone) VALUES(p_shop,btrim(p_data->>'customer_name'),regexp_replace(p_data->>'customer_phone','[^0-9]','','g')) RETURNING id INTO customer;END IF;
 END IF;
 INSERT INTO public.pets(shop_id,customer_id,name,size) VALUES(p_shop,customer,btrim(p_data->>'pet_name'),p_data->>'size') RETURNING id INTO entity;
 END IF;
WHEN 6 THEN
 IF nullif(btrim(p_data->>'name'),'') IS NULL AND (nullif(p_data->>'price','') IS NOT NULL OR nullif(p_data->>'sessions','') IS NOT NULL) THEN RAISE EXCEPTION 'Informe o nome do pacote ou use Pular';END IF;
 IF nullif(btrim(p_data->>'name'),'') IS NOT NULL THEN
 IF nullif(p_data->>'price','') IS NULL OR nullif(p_data->>'sessions','') IS NULL THEN RAISE EXCEPTION 'Informe sessões e preço';END IF;
 price:=(replace(p_data->>'price',',','.'))::numeric;sessions:=(p_data->>'sessions')::integer;
 IF price<0 OR price::text IN('NaN','Infinity','-Infinity') OR sessions<1 THEN RAISE EXCEPTION 'Confira sessões e preço';END IF;
 INSERT INTO public.service_packages(shop_id,name,total_sessions,price,validity_days) VALUES(p_shop,btrim(p_data->>'name'),sessions,price,nullif(p_data->>'validity','')::integer) RETURNING id INTO entity;
 END IF;
ELSE RAISE EXCEPTION 'Etapa inválida';END CASE;
UPDATE public.initial_setup SET step=CASE WHEN p_advance THEN least(6,p_step+1) ELSE step END,status=CASE WHEN p_advance AND p_step=6 THEN 'completed' ELSE status END,drafts=drafts-p_step::text,updated_at=now() WHERE shop_id=p_shop RETURNING to_jsonb(initial_setup.*) INTO result;
result:=result||jsonb_build_object('saved_entity_id',entity);
INSERT INTO private.setup_saves VALUES(p_request,p_shop,result);
RETURN result;END $$;
REVOKE ALL ON FUNCTION public.save_initial_setup_draft(uuid,integer,jsonb),public.save_initial_setup_step(uuid,integer,uuid,jsonb,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_initial_setup_draft(uuid,integer,jsonb),public.save_initial_setup_step(uuid,integer,uuid,jsonb,boolean) TO authenticated;
