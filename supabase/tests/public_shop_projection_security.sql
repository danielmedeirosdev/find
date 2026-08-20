-- Security regression checks for the public shop projection.
-- Run after applying all migrations.

-- Visitors can query the safe projection but not the tenant table.
SELECT
  has_table_privilege('anon', 'public.public_shops', 'SELECT') AS anon_can_read_projection,
  has_table_privilege('anon', 'public.public_barbers', 'SELECT') AS anon_can_read_barber_projection,
  NOT has_table_privilege('anon', 'public.shops', 'SELECT') AS anon_cannot_read_shops,
  NOT has_table_privilege('anon', 'public.barbers', 'SELECT') AS anon_cannot_read_barbers;

-- Sensitive and tenant-only fields must never be added to the projection.
SELECT NOT EXISTS (
  SELECT 1
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'public_shops'
    AND column_name IN (
      'owner_user_id',
      'cpf_cnpj',
      'asaas_customer_id',
      'asaas_subscription_id',
      'trial_ends_at',
      'complimentary_until'
    )
) AS projection_hides_sensitive_columns;

SELECT NOT EXISTS (
  SELECT 1
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'public_barbers'
    AND column_name IN ('commission_percent', 'user_id')
) AS barber_projection_hides_sensitive_columns;

-- The old broad policy must stay removed from the source table.
SELECT NOT EXISTS (
  SELECT 1
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'shops'
    AND policyname = 'Public can read active shops'
) AS broad_shops_policy_removed;

SELECT NOT EXISTS (
  SELECT 1
  FROM pg_policies
  WHERE schemaname = 'public'
    AND policyname IN (
      'publico le lojas ativas',
      'publico le barbers',
      'publico le services',
      'publico le agenda'
    )
) AS legacy_public_policies_removed;
