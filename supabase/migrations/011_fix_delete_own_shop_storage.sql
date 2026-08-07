-- Fix: Supabase blocks DELETE on storage.objects from SQL.
-- Media cleanup is done via Storage API in the frontend before calling this RPC.

CREATE OR REPLACE FUNCTION public.delete_own_shop()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_shop_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT id INTO v_shop_id
  FROM shops
  WHERE owner_user_id = v_user_id;

  IF v_shop_id IS NULL THEN
    RAISE EXCEPTION 'Barbearia não encontrada';
  END IF;

  DELETE FROM shops
  WHERE id = v_shop_id
    AND owner_user_id = v_user_id;

  DELETE FROM auth.users
  WHERE id = v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_own_shop() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_own_shop() TO authenticated;

NOTIFY pgrst, 'reload schema';
