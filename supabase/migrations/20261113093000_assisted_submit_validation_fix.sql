CREATE OR REPLACE FUNCTION public.submit_assisted_setup(p_id uuid,p_payload jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
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
