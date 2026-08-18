-- Security regression checks for staff area + billing/referral isolation.
-- Run via Supabase SQL editor / MCP execute_sql (read-only assertions).

-- 1) Helpers exist
SELECT
  to_regprocedure('public.is_shop_staff(uuid)') IS NOT NULL AS has_is_shop_staff,
  to_regprocedure('public.is_booking_assignee(uuid)') IS NOT NULL AS has_is_booking_assignee,
  to_regprocedure('public.staff_barber_id(uuid)') IS NOT NULL AS has_staff_barber_id;

-- 2) barbers.user_id column exists
SELECT EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'barbers' AND column_name = 'user_id'
) AS has_barbers_user_id;

-- 3) Staff policies present
SELECT COUNT(*) FILTER (WHERE policyname ILIKE 'staff%') AS staff_policies
FROM pg_policies
WHERE schemaname = 'public';

-- 4) Financial remains owner-scoped (no staff ALL policy)
SELECT COUNT(*) AS staff_financial_policies
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'financial_transactions'
  AND policyname ILIKE 'staff%';

-- 5) Referral tables remain owner-read
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('referral_rewards', 'referrals', 'referral_codes')
ORDER BY 1, 2;

-- 6) Billing protect trigger still present
SELECT tgname
FROM pg_trigger
WHERE tgrelid = 'public.shops'::regclass
  AND NOT tgisinternal
  AND tgname ILIKE '%billing%';
