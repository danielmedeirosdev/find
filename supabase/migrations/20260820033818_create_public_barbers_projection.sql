BEGIN;

-- Public projection for professional profiles. Financial commission and the
-- linked auth.users id remain exclusively on public.barbers.
CREATE TABLE public.public_barbers (
  id UUID PRIMARY KEY REFERENCES public.barbers(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES public.public_shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  photo_url TEXT,
  role TEXT
);

CREATE INDEX public_barbers_shop_id_idx
  ON public.public_barbers (shop_id);

ALTER TABLE public.public_barbers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active professional profiles"
  ON public.public_barbers
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.public_shops ps
      WHERE ps.id = public_barbers.shop_id
    )
  );

REVOKE ALL ON public.public_barbers FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.public_barbers TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.sync_public_barber_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.public_barbers (
    id,
    shop_id,
    name,
    photo_url,
    role
  )
  VALUES (
    NEW.id,
    NEW.shop_id,
    NEW.name,
    NEW.photo_url,
    NEW.role
  )
  ON CONFLICT (id) DO UPDATE SET
    shop_id = EXCLUDED.shop_id,
    name = EXCLUDED.name,
    photo_url = EXCLUDED.photo_url,
    role = EXCLUDED.role;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_public_barber_profile()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS barbers_sync_public_profile ON public.barbers;
CREATE TRIGGER barbers_sync_public_profile
  AFTER INSERT OR UPDATE OF shop_id, name, photo_url, role
  ON public.barbers
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_public_barber_profile();

INSERT INTO public.public_barbers (
  id,
  shop_id,
  name,
  photo_url,
  role
)
SELECT
  id,
  shop_id,
  name,
  photo_url,
  role
FROM public.barbers
ON CONFLICT (id) DO UPDATE SET
  shop_id = EXCLUDED.shop_id,
  name = EXCLUDED.name,
  photo_url = EXCLUDED.photo_url,
  role = EXCLUDED.role;

NOTIFY pgrst, 'reload schema';

COMMIT;
