-- RLS policies call is_shop_owner(); anon needs EXECUTE so denied rows return empty, not 42501.
-- The function only returns whether auth.uid() owns the shop — no PII.
GRANT EXECUTE ON FUNCTION public.is_shop_owner(uuid) TO anon, authenticated;
