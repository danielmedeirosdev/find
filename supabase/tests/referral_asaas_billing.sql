-- Verificações de segurança da integração Asaas + referral.
-- Executar com o papel postgres/service_role. Não altera dados de clientes.

-- 1) RPCs de lock/finalize não podem ser chamadas pelo frontend.
-- 2) redeem_referral_reward antigo não pode ser chamado por authenticated.
-- 3) asaas_subscription_id não é gravável pelo frontend (trigger + revoke).

DO $$
DECLARE
  lock_acl TEXT;
  redeem_acl TEXT;
BEGIN
  SELECT pg_catalog.array_to_string(p.proacl, ',')
  INTO lock_acl
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'lock_referral_reward';

  SELECT pg_catalog.array_to_string(p.proacl, ',')
  INTO redeem_acl
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'redeem_referral_reward';

  IF lock_acl ILIKE '%authenticated=%' OR lock_acl ILIKE '%anon=%' THEN
    RAISE EXCEPTION 'lock_referral_reward ainda executável no frontend: %', lock_acl;
  END IF;
  IF redeem_acl ILIKE '%authenticated=%' OR redeem_acl ILIKE '%anon=%' THEN
    RAISE EXCEPTION 'redeem_referral_reward ainda executável no frontend: %', redeem_acl;
  END IF;
END;
$$;

-- lock com dono inexistente não aplica nada
SELECT public.lock_referral_reward(
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002'
) AS lock_no_shop;
