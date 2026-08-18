-- 034's column-level REVOKE INSERT (asaas_*) dropped table INSERT for
-- anon/authenticated without restoring per-column INSERT. Shop signup needs INSERT.
-- Do not use column REVOKE here; Asaas/billing writes stay blocked by triggers.

GRANT INSERT ON public.shops TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
