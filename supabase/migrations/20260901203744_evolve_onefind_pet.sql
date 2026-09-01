-- Evolucao incremental do ONEFIND PET.
-- Todas as colunas sao opcionais para preservar lojas e pets existentes.

ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS pet_business_type TEXT,
  ADD COLUMN IF NOT EXISTS pet_onboarding_mode TEXT,
  ADD COLUMN IF NOT EXISTS pet_setup_help_requested_at TIMESTAMPTZ;

ALTER TABLE public.shops
  DROP CONSTRAINT IF EXISTS shops_pet_business_type_check,
  ADD CONSTRAINT shops_pet_business_type_check CHECK (
    pet_business_type IS NULL OR pet_business_type IN (
      'grooming',
      'veterinary_clinic',
      'pet_shop',
      'daycare_boarding',
      'dog_walker',
      'training',
      'mixed',
      'other'
    )
  ),
  DROP CONSTRAINT IF EXISTS shops_pet_onboarding_mode_check,
  ADD CONSTRAINT shops_pet_onboarding_mode_check CHECK (
    pet_onboarding_mode IS NULL OR pet_onboarding_mode IN ('self_service', 'guided')
  );

COMMENT ON COLUMN public.shops.pet_business_type IS
  'Ramo principal do negocio PET; nao altera o dashboard nem a isolacao multi-tenant.';
COMMENT ON COLUMN public.shops.pet_onboarding_mode IS
  'Experiencia escolhida no onboarding: configuracao rapida ou guiada no proprio produto.';
COMMENT ON COLUMN public.shops.pet_setup_help_requested_at IS
  'Campo legado preservado por compatibilidade; o onboarding atual nao solicita atendimento humano.';

ALTER TABLE public.pets
  ADD COLUMN IF NOT EXISTS last_visit DATE,
  ADD COLUMN IF NOT EXISTS recommended_frequency_days INTEGER,
  ADD COLUMN IF NOT EXISTS next_recommended_visit DATE,
  ADD COLUMN IF NOT EXISTS preferred_professional_id UUID
    REFERENCES public.barbers(id) ON DELETE SET NULL;

ALTER TABLE public.barbers
  ADD COLUMN IF NOT EXISTS specialty TEXT;

ALTER TABLE public.pets
  DROP CONSTRAINT IF EXISTS pets_recommended_frequency_days_check,
  ADD CONSTRAINT pets_recommended_frequency_days_check CHECK (
    recommended_frequency_days IS NULL
    OR recommended_frequency_days BETWEEN 1 AND 730
  ),
  DROP CONSTRAINT IF EXISTS pets_next_visit_after_last_check,
  ADD CONSTRAINT pets_next_visit_after_last_check CHECK (
    next_recommended_visit IS NULL
    OR last_visit IS NULL
    OR next_recommended_visit >= last_visit
  );

CREATE INDEX IF NOT EXISTS idx_pets_shop_next_recommended_visit
  ON public.pets (shop_id, next_recommended_visit)
  WHERE next_recommended_visit IS NOT NULL;

-- Preserva e aproveita o historico ja existente sem sobrescrever datas mais recentes.
WITH completed_visits AS (
  SELECT pet_id, MAX(date)::date AS last_visit
  FROM (
    SELECT b.pet_id, b.date
    FROM public.bookings b
    WHERE b.status = 'completed' AND b.pet_id IS NOT NULL
    UNION ALL
    SELECT bp.pet_id, b.date
    FROM public.booking_pets bp
    JOIN public.bookings b ON b.id = bp.booking_id
    WHERE b.status = 'completed'
  ) visits
  GROUP BY pet_id
)
UPDATE public.pets p
SET
  last_visit = GREATEST(p.last_visit, completed_visits.last_visit),
  next_recommended_visit = CASE
    WHEN p.recommended_frequency_days IS NOT NULL THEN
      GREATEST(p.last_visit, completed_visits.last_visit) + p.recommended_frequency_days
    ELSE p.next_recommended_visit
  END
FROM completed_visits
WHERE completed_visits.pet_id = p.id
  AND (p.last_visit IS NULL OR completed_visits.last_visit > p.last_visit);

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.sync_pet_return_after_booking_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'completed'
    AND (OLD.status IS DISTINCT FROM 'completed' OR OLD.date IS DISTINCT FROM NEW.date) THEN
    UPDATE public.pets p
    SET
      last_visit = CASE
        WHEN p.last_visit IS NULL OR NEW.date > p.last_visit THEN NEW.date
        ELSE p.last_visit
      END,
      next_recommended_visit = CASE
        WHEN p.recommended_frequency_days IS NOT NULL THEN
          GREATEST(COALESCE(p.last_visit, NEW.date), NEW.date) + p.recommended_frequency_days
        ELSE p.next_recommended_visit
      END
    WHERE p.shop_id = NEW.shop_id
      AND (
        p.id = NEW.pet_id
        OR EXISTS (
          SELECT 1
          FROM public.booking_pets bp
          WHERE bp.booking_id = NEW.id AND bp.pet_id = p.id
        )
      );
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.sync_pet_return_after_booking_completion()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS bookings_sync_pet_return ON public.bookings;
CREATE TRIGGER bookings_sync_pet_return
  AFTER UPDATE OF status, date ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION private.sync_pet_return_after_booking_completion();

-- Clinica basica: historico operacional, sem prescricao ou prontuario legal formal.
CREATE TABLE IF NOT EXISTS public.pet_consultations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  pet_id UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  veterinarian_id UUID REFERENCES public.barbers(id) ON DELETE SET NULL,
  consultation_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  weight_kg NUMERIC CHECK (weight_kg IS NULL OR weight_kg > 0),
  notes TEXT,
  return_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pet_vaccinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  pet_id UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  vaccine_name TEXT NOT NULL CHECK (char_length(btrim(vaccine_name)) BETWEEN 1 AND 120),
  administered_on DATE,
  next_due_date DATE,
  veterinarian_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (next_due_date IS NULL OR administered_on IS NULL OR next_due_date >= administered_on)
);

-- Estoque basico: cadastro e alerta. Nao representa vendas nem um ERP fiscal.
CREATE TABLE IF NOT EXISTS public.inventory_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 140),
  sku TEXT,
  cost_price NUMERIC NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
  sale_price NUMERIC NOT NULL DEFAULT 0 CHECK (sale_price >= 0),
  quantity NUMERIC NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  minimum_stock NUMERIC NOT NULL DEFAULT 0 CHECK (minimum_stock >= 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pet_consultations_shop_date
  ON public.pet_consultations (shop_id, consultation_date DESC);
CREATE INDEX IF NOT EXISTS idx_pet_consultations_pet
  ON public.pet_consultations (pet_id);
CREATE INDEX IF NOT EXISTS idx_pet_consultations_veterinarian
  ON public.pet_consultations (veterinarian_id)
  WHERE veterinarian_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pet_vaccinations_shop_due
  ON public.pet_vaccinations (shop_id, next_due_date);
CREATE INDEX IF NOT EXISTS idx_pet_vaccinations_pet
  ON public.pet_vaccinations (pet_id);
CREATE INDEX IF NOT EXISTS idx_inventory_products_shop_name
  ON public.inventory_products (shop_id, name);

ALTER TABLE public.pet_consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pet_vaccinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owners manage pet consultations" ON public.pet_consultations;
DROP POLICY IF EXISTS "staff read pet consultations" ON public.pet_consultations;
CREATE POLICY "owners and staff read pet consultations"
  ON public.pet_consultations FOR SELECT TO authenticated
  USING (public.is_shop_owner(shop_id) OR public.is_shop_staff(shop_id));
CREATE POLICY "owners insert pet consultations"
  ON public.pet_consultations FOR INSERT TO authenticated
  WITH CHECK (public.is_shop_owner(shop_id));
CREATE POLICY "owners update pet consultations"
  ON public.pet_consultations FOR UPDATE TO authenticated
  USING (public.is_shop_owner(shop_id))
  WITH CHECK (public.is_shop_owner(shop_id));
CREATE POLICY "owners delete pet consultations"
  ON public.pet_consultations FOR DELETE TO authenticated
  USING (public.is_shop_owner(shop_id));

DROP POLICY IF EXISTS "owners manage pet vaccinations" ON public.pet_vaccinations;
DROP POLICY IF EXISTS "staff read pet vaccinations" ON public.pet_vaccinations;
CREATE POLICY "owners and staff read pet vaccinations"
  ON public.pet_vaccinations FOR SELECT TO authenticated
  USING (public.is_shop_owner(shop_id) OR public.is_shop_staff(shop_id));
CREATE POLICY "owners insert pet vaccinations"
  ON public.pet_vaccinations FOR INSERT TO authenticated
  WITH CHECK (public.is_shop_owner(shop_id));
CREATE POLICY "owners update pet vaccinations"
  ON public.pet_vaccinations FOR UPDATE TO authenticated
  USING (public.is_shop_owner(shop_id))
  WITH CHECK (public.is_shop_owner(shop_id));
CREATE POLICY "owners delete pet vaccinations"
  ON public.pet_vaccinations FOR DELETE TO authenticated
  USING (public.is_shop_owner(shop_id));

DROP POLICY IF EXISTS "owners manage inventory products" ON public.inventory_products;
DROP POLICY IF EXISTS "staff read inventory products" ON public.inventory_products;
CREATE POLICY "owners and staff read inventory products"
  ON public.inventory_products FOR SELECT TO authenticated
  USING (public.is_shop_owner(shop_id) OR public.is_shop_staff(shop_id));
CREATE POLICY "owners insert inventory products"
  ON public.inventory_products FOR INSERT TO authenticated
  WITH CHECK (public.is_shop_owner(shop_id));
CREATE POLICY "owners update inventory products"
  ON public.inventory_products FOR UPDATE TO authenticated
  USING (public.is_shop_owner(shop_id))
  WITH CHECK (public.is_shop_owner(shop_id));
CREATE POLICY "owners delete inventory products"
  ON public.inventory_products FOR DELETE TO authenticated
  USING (public.is_shop_owner(shop_id));

REVOKE ALL ON public.pet_consultations, public.pet_vaccinations, public.inventory_products
  FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.pet_consultations, public.pet_vaccinations, public.inventory_products
  TO authenticated;

NOTIFY pgrst, 'reload schema';
