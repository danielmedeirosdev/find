-- Preserve bookings made by the professional as a client at other shops.
-- The shop deletion itself cascades all data owned by the shop. Any remaining
-- booking may still reference the same auth user through bookings.client_id.

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
  FROM public.shops
  WHERE owner_user_id = v_user_id;

  IF v_shop_id IS NULL THEN
    RAISE EXCEPTION 'Estabelecimento não encontrado';
  END IF;

  DELETE FROM public.shops
  WHERE id = v_shop_id
    AND owner_user_id = v_user_id;

  -- Bookings at the deleted shop are already gone through shops ON DELETE
  -- CASCADE. Keep bookings at other shops while removing the auth reference.
  UPDATE public.bookings
  SET client_id = NULL
  WHERE client_id = v_user_id;

  DELETE FROM auth.users
  WHERE id = v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_own_shop() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_own_shop() TO authenticated;

NOTIFY pgrst, 'reload schema';
