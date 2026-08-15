-- Owner/dashboard RPCs must not be callable by anonymous clients.
REVOKE EXECUTE ON FUNCTION public.complete_booking(uuid, uuid[], text, numeric, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_booking_status(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.delete_own_shop() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.consume_package_session(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.claim_my_bookings() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.submit_review(uuid, smallint, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.complete_booking(uuid, uuid[], text, numeric, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_booking_status(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_own_shop() TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_package_session(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_my_bookings() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_shop_owner(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_review(uuid, smallint, text) TO authenticated;
