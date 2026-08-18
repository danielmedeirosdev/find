-- Restore shops table privileges accidentally stripped by column-level
-- REVOKE SELECT (asaas_subscription_id). In Postgres, revoking a column
-- privilege from a table-level GRANT ALL can drop table SELECT/INSERT/UPDATE
-- for anon/authenticated. PostgREST then rejects shops select('*') with 403
-- and the dashboard cannot load.
--
-- Writes to Asaas identifiers stay blocked (column revoke + existing triggers).
-- Billing status remains protected by protect_shop_billing_columns.

GRANT SELECT, INSERT, UPDATE ON public.shops TO anon, authenticated;

-- Do not REVOKE column privileges on shops: in Postgres that can drop table-level
-- SELECT/INSERT for anon/authenticated (this is what broke the dashboard).
-- Asaas IDs and billing status remain non-writable via
-- protect_shop_asaas_columns and protect_shop_billing_columns.

NOTIFY pgrst, 'reload schema';
