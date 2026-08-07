-- Allow owners to permanently delete their barbershop and all related data

DROP POLICY IF EXISTS "Owners can delete own shop" ON shops;
CREATE POLICY "Owners can delete own shop"
  ON shops FOR DELETE
  USING (owner_user_id = auth.uid());

-- Deletes shop media, cascades all shop data, then removes the owner auth account
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

  DELETE FROM storage.objects
  WHERE bucket_id = 'shop-media'
    AND name LIKE v_shop_id::text || '/%';

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
