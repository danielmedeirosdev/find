-- Operational permission checks are used only by authenticated staff policies.
REVOKE EXECUTE ON FUNCTION public.can_manage_shop_operations(uuid) FROM anon;
