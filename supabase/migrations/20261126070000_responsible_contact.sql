CREATE TABLE private.responsible_contact_policy(started_at timestamptz NOT NULL DEFAULT now());
INSERT INTO private.responsible_contact_policy DEFAULT VALUES;
CREATE TABLE private.responsible_contacts(shop_id uuid PRIMARY KEY REFERENCES public.shops(id) ON DELETE CASCADE,user_id uuid NOT NULL REFERENCES auth.users(id),phone text CHECK(phone IS NULL OR phone ~ '^55[1-9][0-9]9[0-9]{8}$'),method text NOT NULL,new_registration boolean NOT NULL DEFAULT false,updated_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE private.responsible_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.responsible_contact_policy ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.responsible_contacts,private.responsible_contact_policy FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION private.normalize_responsible_phone(p_phone text) RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE d text:=regexp_replace(coalesce(p_phone,''),'[^0-9]','','g');BEGIN
IF length(d)=13 AND left(d,2)='55' THEN d:=substr(d,3);END IF;
IF length(d)<>11 OR substr(d,3,1)<>'9' OR substr(d,1,2)<>ALL(string_to_array('11 12 13 14 15 16 17 18 19 21 22 24 27 28 31 32 33 34 35 37 38 41 42 43 44 45 46 47 48 49 51 53 54 55 61 62 63 64 65 66 67 68 69 71 73 74 75 77 79 81 82 83 84 85 86 87 88 89 91 92 93 94 95 96 97 98 99',' ')) OR substr(d,4) ~ '^([0-9])\1{7}$' THEN RAISE EXCEPTION 'Informe um celular com DDD válido e 11 dígitos';END IF;RETURN '55'||d;END $$;
REVOKE ALL ON FUNCTION private.normalize_responsible_phone(text) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION private.prepare_responsible_contact() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u auth.users; phone_value text;BEGIN
SELECT * INTO u FROM auth.users WHERE id=NEW.owner_user_id;
IF u.created_at < (SELECT started_at FROM private.responsible_contact_policy) THEN RETURN NEW;END IF;
IF nullif(u.raw_user_meta_data->>'responsible_whatsapp','') IS NOT NULL THEN phone_value:=private.normalize_responsible_phone(u.raw_user_meta_data->>'responsible_whatsapp');END IF;
INSERT INTO private.responsible_contacts(shop_id,user_id,phone,method,new_registration) VALUES(NEW.id,NEW.owner_user_id,phone_value,CASE WHEN u.raw_app_meta_data->>'provider'='google' THEN 'google' ELSE 'email' END,coalesce(auth.role(),'')<>'service_role');RETURN NEW;END $$;
REVOKE ALL ON FUNCTION private.prepare_responsible_contact() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER prepare_responsible_contact AFTER INSERT ON public.shops FOR EACH ROW EXECUTE FUNCTION private.prepare_responsible_contact();
CREATE FUNCTION public.my_responsible_contact() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c private.responsible_contacts;BEGIN
IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado';END IF;
SELECT r.* INTO c FROM private.responsible_contacts r JOIN public.shops s ON s.id=r.shop_id AND s.owner_user_id=auth.uid() WHERE r.user_id=auth.uid();
RETURN jsonb_build_object('required',c.shop_id IS NOT NULL AND c.phone IS NULL,'shop_id',c.shop_id,'method',c.method,'new_registration',coalesce(c.new_registration,false));END $$;
CREATE FUNCTION public.save_responsible_contact(p_phone text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado';END IF;
UPDATE private.responsible_contacts r SET phone=private.normalize_responsible_phone(p_phone),updated_at=now() FROM public.shops s WHERE s.id=r.shop_id AND s.owner_user_id=auth.uid() AND r.user_id=auth.uid();
IF NOT FOUND THEN RAISE EXCEPTION 'Contato pendente não encontrado';END IF;END $$;
CREATE FUNCTION public.admin_responsible_contact(p_shop_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=auth.uid() AND raw_app_meta_data->>'onefind_platform_admin'='true') THEN RAISE EXCEPTION 'Acesso administrativo necessário';END IF;
RETURN (SELECT jsonb_build_object('phone',phone,'updated_at',updated_at) FROM private.responsible_contacts WHERE shop_id=p_shop_id);END $$;
REVOKE ALL ON FUNCTION public.my_responsible_contact(),public.save_responsible_contact(text),public.admin_responsible_contact(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.my_responsible_contact(),public.save_responsible_contact(text),public.admin_responsible_contact(uuid) TO authenticated;
CREATE FUNCTION public.claim_responsible_registration(p_shop_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
IF NOT EXISTS(SELECT 1 FROM public.shops WHERE id=p_shop_id AND owner_user_id=auth.uid()) THEN RETURN false;END IF;
IF NOT EXISTS(SELECT 1 FROM private.responsible_contacts WHERE shop_id=p_shop_id) THEN RETURN true;END IF;
UPDATE private.responsible_contacts SET new_registration=false WHERE shop_id=p_shop_id AND user_id=auth.uid() AND phone IS NOT NULL AND new_registration;
RETURN FOUND;END $$;
REVOKE ALL ON FUNCTION public.claim_responsible_registration(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.claim_responsible_registration(uuid) TO authenticated;
