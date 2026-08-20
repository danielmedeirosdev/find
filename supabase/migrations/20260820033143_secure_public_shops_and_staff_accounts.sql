BEGIN;

-- Public projection for shop discovery and booking. Keep billing, tax and owner
-- identifiers exclusively on public.shops, whose RLS is tenant-scoped.
CREATE TABLE IF NOT EXISTS public.public_shops (
  id UUID PRIMARY KEY REFERENCES public.shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slogan TEXT,
  address TEXT,
  phone TEXT,
  hours_text TEXT,
  description TEXT,
  subscription_status TEXT NOT NULL
    CHECK (subscription_status IN ('trial', 'active', 'blocked')),
  logo_url TEXT,
  slug TEXT,
  segment TEXT NOT NULL
    CHECK (segment IN ('barbershop', 'pet')),
  created_at TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS public_shops_slug_uidx
  ON public.public_shops (slug)
  WHERE slug IS NOT NULL;

ALTER TABLE public.public_shops ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read active shop profiles" ON public.public_shops;
CREATE POLICY "Public read active shop profiles"
  ON public.public_shops
  FOR SELECT
  TO anon, authenticated
  USING (subscription_status <> 'blocked');

REVOKE ALL ON public.public_shops FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.public_shops TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.sync_public_shop_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.public_shops (
    id,
    name,
    slogan,
    address,
    phone,
    hours_text,
    description,
    subscription_status,
    logo_url,
    slug,
    segment,
    created_at
  )
  VALUES (
    NEW.id,
    NEW.name,
    NEW.slogan,
    NEW.address,
    NEW.phone,
    NEW.hours_text,
    NEW.description,
    NEW.subscription_status,
    NEW.logo_url,
    NEW.slug,
    NEW.segment,
    NEW.created_at
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    slogan = EXCLUDED.slogan,
    address = EXCLUDED.address,
    phone = EXCLUDED.phone,
    hours_text = EXCLUDED.hours_text,
    description = EXCLUDED.description,
    subscription_status = EXCLUDED.subscription_status,
    logo_url = EXCLUDED.logo_url,
    slug = EXCLUDED.slug,
    segment = EXCLUDED.segment,
    created_at = EXCLUDED.created_at;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_public_shop_profile()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS shops_sync_public_profile ON public.shops;
CREATE TRIGGER shops_sync_public_profile
  AFTER INSERT OR UPDATE OF
    name,
    slogan,
    address,
    phone,
    hours_text,
    description,
    subscription_status,
    logo_url,
    slug,
    segment
  ON public.shops
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_public_shop_profile();

INSERT INTO public.public_shops (
  id,
  name,
  slogan,
  address,
  phone,
  hours_text,
  description,
  subscription_status,
  logo_url,
  slug,
  segment,
  created_at
)
SELECT
  id,
  name,
  slogan,
  address,
  phone,
  hours_text,
  description,
  subscription_status,
  logo_url,
  slug,
  segment,
  created_at
FROM public.shops
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slogan = EXCLUDED.slogan,
  address = EXCLUDED.address,
  phone = EXCLUDED.phone,
  hours_text = EXCLUDED.hours_text,
  description = EXCLUDED.description,
  subscription_status = EXCLUDED.subscription_status,
  logo_url = EXCLUDED.logo_url,
  slug = EXCLUDED.slug,
  segment = EXCLUDED.segment,
  created_at = EXCLUDED.created_at;

-- Direct reads of shops are now only for authenticated owners/staff through
-- their existing tenant policies. Visitors use public_shops.
DROP POLICY IF EXISTS "Public can read active shops" ON public.shops;
REVOKE ALL ON public.shops FROM PUBLIC, anon;

-- Public child-table policies must no longer depend on direct access to shops.
DROP POLICY IF EXISTS "Public can read services of active shops" ON public.services;
CREATE POLICY "Public can read services of active shops"
  ON public.services
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.public_shops ps
      WHERE ps.id = services.shop_id
    )
  );

DROP POLICY IF EXISTS "Public can read barbers of active shops" ON public.barbers;
CREATE POLICY "Public can read barbers of active shops"
  ON public.barbers
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.public_shops ps
      WHERE ps.id = barbers.shop_id
    )
  );

DROP POLICY IF EXISTS "Public can read schedules of active shops" ON public.barber_schedule;
CREATE POLICY "Public can read schedules of active shops"
  ON public.barber_schedule
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.barbers b
      JOIN public.public_shops ps ON ps.id = b.shop_id
      WHERE b.id = barber_schedule.barber_id
    )
  );

DROP POLICY IF EXISTS "Public read shop photos" ON public.shop_photos;
CREATE POLICY "Public read shop photos"
  ON public.shop_photos
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.public_shops ps
      WHERE ps.id = shop_photos.shop_id
    )
  );

DROP POLICY IF EXISTS "Public read size rules" ON public.service_size_rules;
CREATE POLICY "Public read size rules"
  ON public.service_size_rules
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.services svc
      JOIN public.public_shops ps ON ps.id = svc.shop_id
      WHERE svc.id = service_size_rules.service_id
    )
  );

DROP POLICY IF EXISTS "Public read reviews of active shops" ON public.reviews;
CREATE POLICY "Public read reviews of active shops"
  ON public.reviews
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.public_shops ps
      WHERE ps.id = reviews.shop_id
    )
  );

DROP POLICY IF EXISTS "Public read active service packages" ON public.service_packages;
CREATE POLICY "Public read active service packages"
  ON public.service_packages
  FOR SELECT
  TO anon, authenticated
  USING (
    active
    AND EXISTS (
      SELECT 1
      FROM public.public_shops ps
      WHERE ps.id = service_packages.shop_id
    )
  );

DROP POLICY IF EXISTS "Public read no show policies" ON public.no_show_policies;
CREATE POLICY "Public read no show policies"
  ON public.no_show_policies
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.public_shops ps
      WHERE ps.id = no_show_policies.shop_id
    )
  );

-- Slug checks need to consider blocked shops too, without exposing their rows.
CREATE OR REPLACE FUNCTION public.is_shop_slug_available(
  p_slug TEXT,
  p_exclude_shop_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    (SELECT auth.uid()) IS NOT NULL
    AND p_slug IS NOT NULL
    AND length(p_slug) BETWEEN 1 AND 120
    AND (
      p_exclude_shop_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.shops owned
        WHERE owned.id = p_exclude_shop_id
          AND owned.owner_user_id = (SELECT auth.uid())
      )
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.shops s
      WHERE s.slug = p_slug
        AND (p_exclude_shop_id IS NULL OR s.id <> p_exclude_shop_id)
    );
$$;

REVOKE ALL ON FUNCTION public.is_shop_slug_available(TEXT, UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_shop_slug_available(TEXT, UUID)
  TO authenticated;

-- The staff function no longer needs privileged auth.users email lookup.
DROP FUNCTION IF EXISTS public.auth_user_id_by_email(TEXT);

NOTIFY pgrst, 'reload schema';

COMMIT;
