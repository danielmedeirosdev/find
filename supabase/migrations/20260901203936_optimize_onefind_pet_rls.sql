-- Follow-up applied after the initial ONEFIND PET migration.
-- Adds covering indexes and removes duplicated permissive SELECT policies
-- without changing the effective owner/staff access model.

CREATE INDEX IF NOT EXISTS idx_pet_consultations_pet
  ON public.pet_consultations (pet_id);
CREATE INDEX IF NOT EXISTS idx_pet_consultations_veterinarian
  ON public.pet_consultations (veterinarian_id)
  WHERE veterinarian_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pet_vaccinations_pet
  ON public.pet_vaccinations (pet_id);

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

NOTIFY pgrst, 'reload schema';
