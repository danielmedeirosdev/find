-- Eligibility starts now; never backfill existing establishments or accounts.
CREATE TABLE private.initial_setup_policy(started_at timestamptz NOT NULL DEFAULT now());
INSERT INTO private.initial_setup_policy DEFAULT VALUES;
CREATE TABLE public.initial_setup(shop_id uuid PRIMARY KEY REFERENCES public.shops(id) ON DELETE CASCADE,mode text CHECK(mode IN('self','assisted')),status text NOT NULL DEFAULT 'active' CHECK(status IN('active','deferred','dismissed','completed')),step integer NOT NULL DEFAULT 1 CHECK(step BETWEEN 1 AND 6),skipped integer[] NOT NULL DEFAULT '{}',updated_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.initial_setup ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.initial_setup FROM PUBLIC,anon,authenticated;
GRANT SELECT,UPDATE ON public.initial_setup TO authenticated;
CREATE POLICY setup_owner_read ON public.initial_setup FOR SELECT TO authenticated USING(public.is_shop_owner(shop_id));
CREATE POLICY setup_owner_update ON public.initial_setup FOR UPDATE TO authenticated USING(public.is_shop_owner(shop_id)) WITH CHECK(public.is_shop_owner(shop_id));
REVOKE ALL ON private.initial_setup_policy FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE private.initial_setup_policy ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION private.prepare_initial_setup() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
IF coalesce(auth.role(),'')='service_role' OR NEW.onboarding_completed OR NEW.subscription_status NOT IN('trial') THEN RETURN NEW; END IF;
IF EXISTS(SELECT 1 FROM auth.users WHERE id=NEW.owner_user_id AND created_at >= (SELECT started_at FROM private.initial_setup_policy)) THEN INSERT INTO public.initial_setup(shop_id) VALUES(NEW.id);END IF;
RETURN NEW;END $$;
REVOKE ALL ON FUNCTION private.prepare_initial_setup() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER initial_setup_new_shop AFTER INSERT ON public.shops FOR EACH ROW EXECUTE FUNCTION private.prepare_initial_setup();
CREATE FUNCTION public.admin_initial_setup(p_shop_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=auth.uid() AND raw_app_meta_data->>'onefind_platform_admin'='true') THEN RAISE EXCEPTION 'Acesso administrativo necessário';END IF;
RETURN (SELECT to_jsonb(s) FROM public.initial_setup s WHERE shop_id=p_shop_id);END $$;
REVOKE ALL ON FUNCTION public.admin_initial_setup(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_initial_setup(uuid) TO authenticated;
