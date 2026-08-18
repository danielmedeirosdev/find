-- Prevent RLS infinite recursion on shops/bookings.
-- LANGUAGE sql SECURITY DEFINER helpers can be inlined by Postgres into
-- policies. Inlining is_shop_staff() into "staff le sua loja" makes
-- SELECT shops → barbers (owner policy subquery on shops) → shops again.
-- plpgsql is not inlined, so SECURITY DEFINER actually bypasses RLS.

CREATE OR REPLACE FUNCTION public.is_shop_staff(p_shop_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.barbers
    WHERE shop_id = p_shop_id
      AND user_id = auth.uid()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_booking_assignee(p_booking_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.bookings b
    JOIN public.barbers br ON br.id = b.barber_id
    WHERE b.id = p_booking_id
      AND br.user_id = auth.uid()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_barber_id(p_shop_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id
  INTO v_id
  FROM public.barbers
  WHERE shop_id = p_shop_id
    AND user_id = auth.uid()
  LIMIT 1;
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_shop_staff(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_booking_assignee(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_barber_id(uuid) TO authenticated;
