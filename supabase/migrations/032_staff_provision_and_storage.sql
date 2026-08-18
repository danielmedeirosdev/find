-- Hardening: exact auth email lookup (service_role only) + staff shop-media policies.

-- 1) Resolve auth.users by email without listUsers pagination.
CREATE OR REPLACE FUNCTION public.auth_user_id_by_email(p_email text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'auth', 'public'
AS $$
  SELECT id
  FROM auth.users
  WHERE lower(email) = lower(trim(p_email))
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.auth_user_id_by_email(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auth_user_id_by_email(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auth_user_id_by_email(text) TO service_role;

COMMENT ON FUNCTION public.auth_user_id_by_email(text) IS
  'Service-role only. Exact email → auth.users.id for staff provisioning. Not for client use.';

-- 2) Staff may manage only their own barber photos under:
--    shop-media/{shop_id}/barbers/{barber_id}/*
-- Public SELECT already exists. Owners keep existing shop-wide policies.

DROP POLICY IF EXISTS "Staff upload own barber media" ON storage.objects;
CREATE POLICY "Staff upload own barber media"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'shop-media'
    AND (storage.foldername(name))[2] = 'barbers'
    AND (storage.foldername(name))[1] IN (
      SELECT b.shop_id::text
      FROM public.barbers b
      WHERE b.user_id = auth.uid()
    )
    AND (storage.foldername(name))[3] IN (
      SELECT b.id::text
      FROM public.barbers b
      WHERE b.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Staff update own barber media" ON storage.objects;
CREATE POLICY "Staff update own barber media"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'shop-media'
    AND (storage.foldername(name))[2] = 'barbers'
    AND (storage.foldername(name))[1] IN (
      SELECT b.shop_id::text
      FROM public.barbers b
      WHERE b.user_id = auth.uid()
    )
    AND (storage.foldername(name))[3] IN (
      SELECT b.id::text
      FROM public.barbers b
      WHERE b.user_id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'shop-media'
    AND (storage.foldername(name))[2] = 'barbers'
    AND (storage.foldername(name))[1] IN (
      SELECT b.shop_id::text
      FROM public.barbers b
      WHERE b.user_id = auth.uid()
    )
    AND (storage.foldername(name))[3] IN (
      SELECT b.id::text
      FROM public.barbers b
      WHERE b.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Staff delete own barber media" ON storage.objects;
CREATE POLICY "Staff delete own barber media"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'shop-media'
    AND (storage.foldername(name))[2] = 'barbers'
    AND (storage.foldername(name))[1] IN (
      SELECT b.shop_id::text
      FROM public.barbers b
      WHERE b.user_id = auth.uid()
    )
    AND (storage.foldername(name))[3] IN (
      SELECT b.id::text
      FROM public.barbers b
      WHERE b.user_id = auth.uid()
    )
  );
