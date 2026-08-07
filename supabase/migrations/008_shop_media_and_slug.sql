-- Personalização: logo, galeria, fotos de equipe, slug

ALTER TABLE shops ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS banner_url TEXT;

ALTER TABLE barbers ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE barbers ADD COLUMN IF NOT EXISTS role TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS shops_slug_unique ON shops (slug) WHERE slug IS NOT NULL;

CREATE TABLE IF NOT EXISTS shop_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shop_photos_shop ON shop_photos(shop_id, sort_order);

ALTER TABLE shop_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read shop photos" ON shop_photos;
CREATE POLICY "Public read shop photos"
  ON shop_photos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM shops
      WHERE shops.id = shop_photos.shop_id
        AND shops.subscription_status != 'blocked'
    )
  );

DROP POLICY IF EXISTS "Owners manage shop photos" ON shop_photos;
CREATE POLICY "Owners manage shop photos"
  ON shop_photos FOR ALL
  USING (shop_id IN (SELECT id FROM shops WHERE owner_user_id = auth.uid()))
  WITH CHECK (shop_id IN (SELECT id FROM shops WHERE owner_user_id = auth.uid()));

-- Storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'shop-media',
  'shop-media',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

DROP POLICY IF EXISTS "Public read shop media" ON storage.objects;
CREATE POLICY "Public read shop media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'shop-media');

DROP POLICY IF EXISTS "Owners upload shop media" ON storage.objects;
CREATE POLICY "Owners upload shop media"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'shop-media'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM shops WHERE owner_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owners update shop media" ON storage.objects;
CREATE POLICY "Owners update shop media"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'shop-media'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM shops WHERE owner_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owners delete shop media" ON storage.objects;
CREATE POLICY "Owners delete shop media"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'shop-media'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM shops WHERE owner_user_id = auth.uid()
    )
  );

-- Slug helper
CREATE OR REPLACE FUNCTION public.slugify(input TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  s TEXT;
BEGIN
  s := lower(coalesce(input, ''));
  s := translate(
    s,
    'áàâãäåāăąéèêëēĕėęěíìîïīĭįıóòôõöōŏőúùûüūŭůűųçñýÿÁÀÂÃÄÅÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
    'aaaaaaaaaeeeeeeeeeeiiiiiiiiiooooooooouuuuuuuuucnyyaaaaaaaaeeeeiiiioooooouuuucn'
  );
  s := regexp_replace(s, '[^a-z0-9]+', '-', 'g');
  s := regexp_replace(s, '-+', '-', 'g');
  s := trim(both '-' from s);
  RETURN s;
END;
$$;

-- Backfill slugs for existing shops
DO $$
DECLARE
  r RECORD;
  base TEXT;
  candidate TEXT;
  n INT;
BEGIN
  FOR r IN SELECT id, name, slug FROM shops WHERE slug IS NULL OR slug = '' LOOP
    base := public.slugify(r.name);
    IF base = '' OR base IS NULL THEN
      base := 'barbearia';
    END IF;
    candidate := base;
    n := 1;
    WHILE EXISTS (SELECT 1 FROM shops WHERE slug = candidate AND id <> r.id) LOOP
      n := n + 1;
      candidate := base || '-' || n::text;
    END LOOP;
    UPDATE shops SET slug = candidate WHERE id = r.id;
  END LOOP;
END $$;

-- Signup trigger: also set slug
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT;
  v_base TEXT;
  v_slug TEXT;
  n INT := 1;
BEGIN
  IF NEW.raw_user_meta_data->>'role' = 'barber' THEN
    v_name := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'shop_name'), ''), 'Minha Barbearia');
    v_base := public.slugify(v_name);
    IF v_base IS NULL OR v_base = '' THEN
      v_base := 'barbearia';
    END IF;
    v_slug := v_base;
    WHILE EXISTS (SELECT 1 FROM shops WHERE slug = v_slug) LOOP
      n := n + 1;
      v_slug := v_base || '-' || n::text;
    END LOOP;

    INSERT INTO public.shops (owner_user_id, name, subscription_status, trial_ends_at, slug)
    VALUES (
      NEW.id,
      v_name,
      'trial',
      now() + INTERVAL '30 days',
      v_slug
    )
    ON CONFLICT (owner_user_id) DO NOTHING;
  END IF;

  IF NEW.raw_user_meta_data->>'role' = 'client' THEN
    INSERT INTO public.clients (id, name, phone)
    VALUES (
      NEW.id,
      COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''), 'Cliente'),
      NULLIF(TRIM(NEW.raw_user_meta_data->>'phone'), '')
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
