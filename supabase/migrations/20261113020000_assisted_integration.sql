CREATE SCHEMA IF NOT EXISTS private;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE TABLE private.assisted_integration (singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),enabled boolean NOT NULL DEFAULT true);
INSERT INTO private.assisted_integration DEFAULT VALUES;
CREATE TABLE private.assisted_jobs (
 id uuid PRIMARY KEY, email text NOT NULL UNIQUE, shop_name text NOT NULL UNIQUE,
 payload jsonb NOT NULL, token_hash text NOT NULL, expires_at timestamptz NOT NULL,
 status text NOT NULL DEFAULT 'queued' CHECK(status IN('queued','running','complete','failed')),
 shop_id uuid REFERENCES public.shops(id), trial_eligible boolean NOT NULL,
 activated_at timestamptz, result jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE private.assisted_audit (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,job_id uuid REFERENCES private.assisted_jobs(id),action text NOT NULL,actor text NOT NULL DEFAULT session_user,created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE private.assisted_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.assisted_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.assisted_integration ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.assisted_jobs,private.assisted_audit,private.assisted_integration FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE public.assisted_service_drafts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),shop_id uuid NOT NULL REFERENCES public.shops(id),name text NOT NULL CHECK(length(name) BETWEEN 1 AND 100),source text,UNIQUE(shop_id,name));
ALTER TABLE public.assisted_service_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_drafts ON public.assisted_service_drafts FOR SELECT TO authenticated USING (public.is_shop_owner(shop_id));
GRANT SELECT ON public.assisted_service_drafts TO authenticated;
GRANT ALL ON public.assisted_service_drafts TO service_role;
CREATE TABLE public.assisted_shop_setup (
 shop_id uuid PRIMARY KEY REFERENCES public.shops(id),
 business_hours jsonb NOT NULL DEFAULT '[]', pending_notes jsonb NOT NULL DEFAULT '[]', source text
);
ALTER TABLE public.assisted_shop_setup ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_setup ON public.assisted_shop_setup FOR SELECT TO authenticated USING (public.is_shop_owner(shop_id));
REVOKE ALL ON public.assisted_shop_setup, public.assisted_service_drafts FROM anon;
GRANT SELECT ON public.assisted_shop_setup TO authenticated;
GRANT ALL ON public.assisted_shop_setup TO service_role;
CREATE FUNCTION public.submit_assisted_setup(p_id uuid,p_payload jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE token text:=encode(extensions.gen_random_bytes(32),'hex'); v_email text:=lower(trim(p_payload->>'email')); v_name text:=lower(trim(p_payload->>'shopName')); old private.assisted_jobs%rowtype; eligible boolean;
BEGIN
 IF session_user NOT IN ('postgres','supabase_admin') THEN RAISE EXCEPTION 'Use a conexão administrativa autorizada'; END IF;
 IF NOT (SELECT enabled FROM private.assisted_integration) THEN RAISE EXCEPTION 'Integração revogada'; END IF;
 IF p_id IS NULL OR v_email IS NULL OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' OR v_name IS NULL OR length(v_name) NOT BETWEEN 2 AND 120 OR pg_column_size(p_payload)>6000000 THEN RAISE EXCEPTION 'Dados inválidos'; END IF;
 SELECT * INTO old FROM private.assisted_jobs WHERE id=p_id;
 IF old.id IS NOT NULL THEN IF old.payload<>p_payload THEN RAISE EXCEPTION 'Identificador já utilizado'; END IF;RETURN old.id;END IF;
 IF EXISTS(SELECT 1 FROM auth.users WHERE lower(auth.users.email)=v_email) OR EXISTS(SELECT 1 FROM public.shops WHERE lower(trim(shops.name))=v_name) THEN RAISE EXCEPTION 'Conta ou loja existente: é necessária confirmação específica antes de alterar'; END IF;
 IF jsonb_typeof(p_payload->'profile') IS DISTINCT FROM 'object' OR jsonb_typeof(p_payload->'services') IS DISTINCT FROM 'array' OR jsonb_typeof(p_payload->'staff') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Perfil, serviços e equipe são obrigatórios'; END IF;
 eligible:=NOT EXISTS(SELECT 1 FROM private.trial_entitlements WHERE email_fingerprint=private.trial_email_fingerprint(v_email));
 INSERT INTO private.assisted_jobs(id,email,shop_name,payload,token_hash,expires_at,trial_eligible) VALUES(p_id,v_email,v_name,p_payload,encode(extensions.digest(token,'sha256'),'hex'),now()+interval '10 minutes',eligible);
 INSERT INTO private.assisted_audit(job_id,action) VALUES(p_id,'submitted');
 PERFORM net.http_post(url:='https://znjgmtkmweujzitgwhos.supabase.co/functions/v1/assisted-setup-worker',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||token),body:=jsonb_build_object('jobId',p_id),timeout_milliseconds:=60000);
 RETURN p_id;
END $$;
REVOKE ALL ON FUNCTION public.submit_assisted_setup(uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.claim_assisted_setup(p_id uuid,p_token text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j private.assisted_jobs%rowtype;
BEGIN
 SELECT * INTO j FROM private.assisted_jobs WHERE id=p_id FOR UPDATE;
 IF j.id IS NULL OR j.status<>'queued' OR j.expires_at<now() OR j.token_hash<>encode(extensions.digest(p_token,'sha256'),'hex') OR NOT(SELECT enabled FROM private.assisted_integration) THEN RAISE EXCEPTION 'Operação não autorizada'; END IF;
 UPDATE private.assisted_jobs SET status='running',token_hash='' WHERE id=p_id;
 INSERT INTO private.assisted_audit(job_id,action) VALUES(p_id,'claimed');
 RETURN j.payload;
END $$;
CREATE FUNCTION public.finish_assisted_setup(p_id uuid,p_shop_id uuid,p_result jsonb,p_success boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 UPDATE private.assisted_jobs SET shop_id=p_shop_id,result=p_result,status=CASE WHEN p_success THEN 'complete' ELSE 'failed' END WHERE id=p_id AND status='running';
 IF NOT FOUND THEN RAISE EXCEPTION 'Operação não está em execução'; END IF;
 INSERT INTO private.assisted_audit(job_id,action) VALUES(p_id,CASE WHEN p_success THEN 'completed' ELSE 'failed' END);
END $$;
REVOKE ALL ON FUNCTION public.claim_assisted_setup(uuid,text),public.finish_assisted_setup(uuid,uuid,jsonb,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_assisted_setup(uuid,text),public.finish_assisted_setup(uuid,uuid,jsonb,boolean) TO service_role;
CREATE FUNCTION private.activate_assisted_trial() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j private.assisted_jobs%rowtype;
BEGIN
 IF OLD.last_sign_in_at IS NULL AND NEW.last_sign_in_at IS NOT NULL THEN
 SELECT q.* INTO j FROM private.assisted_jobs q JOIN public.shops s ON s.id=q.shop_id WHERE s.owner_user_id=NEW.id AND q.status='complete' AND q.activated_at IS NULL FOR UPDATE OF q;
 IF j.id IS NOT NULL THEN
 UPDATE private.assisted_jobs SET activated_at=now() WHERE id=j.id;
 IF j.trial_eligible THEN
 UPDATE private.trial_entitlements SET first_started_at=now(),expires_at=now()+interval '30 days' WHERE email_fingerprint=private.trial_email_fingerprint(NEW.email);
 UPDATE public.shops SET subscription_status='trial',trial_ends_at=now()+interval '30 days' WHERE id=j.shop_id;
 END IF;
 INSERT INTO private.assisted_audit(job_id,action) VALUES(j.id,'activated');
 END IF;
 END IF;RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.activate_assisted_trial() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER activate_assisted_trial AFTER UPDATE OF last_sign_in_at ON auth.users FOR EACH ROW EXECUTE FUNCTION private.activate_assisted_trial();
CREATE FUNCTION public.confirm_assisted_service(p_draft_id uuid,p_price numeric,p_duration integer) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d public.assisted_service_drafts%rowtype; service_id uuid;
BEGIN
 SELECT * INTO d FROM public.assisted_service_drafts WHERE id=p_draft_id FOR UPDATE;
 IF auth.uid() IS NULL OR d.id IS NULL OR NOT public.is_shop_owner(d.shop_id) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
 IF p_price IS NULL OR p_price<0 OR p_price::text IN('NaN','Infinity','-Infinity') OR p_duration IS NULL OR p_duration<1 OR p_duration>720 THEN RAISE EXCEPTION 'Informe preço e duração'; END IF;
 service_id:=public.save_pet_service_duration(d.shop_id,null,d.name,p_price,p_duration,null);
 DELETE FROM public.assisted_service_drafts WHERE id=d.id;
 RETURN service_id;
END $$;
REVOKE ALL ON FUNCTION public.confirm_assisted_service(uuid,numeric,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.confirm_assisted_service(uuid,numeric,integer) TO authenticated;
CREATE FUNCTION public.audit_assisted_step(p_id uuid,p_step text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_step NOT IN('account_created','media_saved','configuration_saved','invite_generated') OR NOT EXISTS(SELECT 1 FROM private.assisted_jobs WHERE id=p_id AND status='running') THEN RAISE EXCEPTION 'Operação inválida';END IF;
 INSERT INTO private.assisted_audit(job_id,action) VALUES(p_id,p_step);
END $$;
REVOKE ALL ON FUNCTION public.audit_assisted_step(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.audit_assisted_step(uuid,text) TO service_role;
