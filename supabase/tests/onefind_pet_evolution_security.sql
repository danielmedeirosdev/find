-- Regression checks for the incremental ONEFIND PET migration.
-- Run after applying 20260901200700_evolve_onefind_pet.sql.

-- Structured onboarding and recurrence columns exist.
SELECT
  to_regclass('public.pet_consultations') IS NOT NULL AS has_pet_consultations,
  to_regclass('public.pet_vaccinations') IS NOT NULL AS has_pet_vaccinations,
  to_regclass('public.inventory_products') IS NOT NULL AS has_inventory_products,
  to_regprocedure('private.sync_pet_return_after_booking_completion()') IS NOT NULL
    AS has_return_sync;

SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'shops' AND column_name IN (
      'pet_business_type', 'pet_onboarding_mode', 'pet_setup_help_requested_at'
    ))
    OR (table_name = 'pets' AND column_name IN (
      'last_visit', 'recommended_frequency_days', 'next_recommended_visit',
      'preferred_professional_id'
    ))
    OR (table_name = 'barbers' AND column_name = 'specialty')
  )
ORDER BY table_name, column_name;

-- Every new table has RLS enabled.
SELECT relname, relrowsecurity
FROM pg_class
WHERE oid IN (
  'public.pet_consultations'::regclass,
  'public.pet_vaccinations'::regclass,
  'public.inventory_products'::regclass
)
ORDER BY relname;

-- Owner and staff-read policies exist; no anon policy is expected.
SELECT tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('pet_consultations', 'pet_vaccinations', 'inventory_products')
ORDER BY tablename, policyname;

-- anon must not have direct table privileges.
SELECT table_name, privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'anon'
  AND table_schema = 'public'
  AND table_name IN ('pet_consultations', 'pet_vaccinations', 'inventory_products');

-- The trigger function is internal and not executable by client roles.
SELECT
  has_function_privilege(
    'anon',
    'private.sync_pet_return_after_booking_completion()',
    'EXECUTE'
  ) AS anon_can_execute_return_sync,
  has_function_privilege(
    'authenticated',
    'private.sync_pet_return_after_booking_completion()',
    'EXECUTE'
  ) AS authenticated_can_execute_return_sync;
