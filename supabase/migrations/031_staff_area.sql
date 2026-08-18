-- Staff (profissional) area: link barbers to auth users with backend-enforced permissions.
-- Owners manage the business; staff execute their own agenda only.

ALTER TABLE public.barbers
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS barbers_user_id_unique
  ON public.barbers (user_id)
  WHERE user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.is_shop_staff(p_shop_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.barbers
    WHERE shop_id = p_shop_id
      AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_booking_assignee(p_booking_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.bookings b
    JOIN public.barbers br ON br.id = b.barber_id
    WHERE b.id = p_booking_id
      AND br.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.staff_barber_id(p_shop_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id
  FROM public.barbers
  WHERE shop_id = p_shop_id
    AND user_id = auth.uid()
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.is_shop_staff(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_booking_assignee(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_barber_id(uuid) TO authenticated;

-- Prevent clients from forging staff login links or escalating privileges.
CREATE OR REPLACE FUNCTION public.protect_barber_auth_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.shop_id IS DISTINCT FROM OLD.shop_id THEN
      RAISE EXCEPTION 'Não é permitido mover profissional entre estabelecimentos';
    END IF;

    IF NEW.user_id IS DISTINCT FROM OLD.user_id
       AND coalesce(auth.role(), '') <> 'service_role' THEN
      RAISE EXCEPTION 'Vínculo de acesso do profissional só pode ser gerenciado pelo sistema';
    END IF;

    -- Staff may update own profile fields only (name/photo/role).
    IF auth.uid() IS NOT NULL
       AND OLD.user_id = auth.uid()
       AND NOT public.is_shop_owner(OLD.shop_id) THEN
      IF NEW.commission_percent IS DISTINCT FROM OLD.commission_percent THEN
        RAISE EXCEPTION 'Profissional não pode alterar comissão';
      END IF;
      NEW.user_id := OLD.user_id;
      NEW.shop_id := OLD.shop_id;
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    IF NEW.user_id IS NOT NULL
       AND coalesce(auth.role(), '') <> 'service_role' THEN
      RAISE EXCEPTION 'Vínculo de acesso do profissional só pode ser gerenciado pelo sistema';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_barber_auth_link ON public.barbers;
CREATE TRIGGER trg_protect_barber_auth_link
  BEFORE INSERT OR UPDATE ON public.barbers
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_barber_auth_link();

-- Staff can read their shop (even if blocked) for operational context — no admin UPDATE.
DROP POLICY IF EXISTS "staff le sua loja" ON public.shops;
CREATE POLICY "staff le sua loja"
  ON public.shops
  FOR SELECT
  TO authenticated
  USING (public.is_shop_staff(id));

-- Staff read/update own barber profile (public SELECT already exists).
DROP POLICY IF EXISTS "staff atualiza proprio perfil" ON public.barbers;
CREATE POLICY "staff atualiza proprio perfil"
  ON public.barbers
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Bookings: staff see only their own appointments.
DROP POLICY IF EXISTS "staff le proprios bookings" ON public.bookings;
CREATE POLICY "staff le proprios bookings"
  ON public.bookings
  FOR SELECT
  TO authenticated
  USING (public.is_booking_assignee(id));

DROP POLICY IF EXISTS "staff le booking services" ON public.booking_services;
CREATE POLICY "staff le booking services"
  ON public.booking_services
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.bookings b
      JOIN public.barbers br ON br.id = b.barber_id
      WHERE b.id = booking_services.booking_id
        AND br.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "staff le booking pets" ON public.booking_pets;
CREATE POLICY "staff le booking pets"
  ON public.booking_pets
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.bookings b
      JOIN public.barbers br ON br.id = b.barber_id
      WHERE b.id = booking_pets.booking_id
        AND br.user_id = auth.uid()
    )
  );

-- Operational reads for assigned shop (no writes for admin tables).
DROP POLICY IF EXISTS "staff le clientes da loja" ON public.shop_customers;
CREATE POLICY "staff le clientes da loja"
  ON public.shop_customers
  FOR SELECT
  TO authenticated
  USING (public.is_shop_staff(shop_id));

DROP POLICY IF EXISTS "staff le pets da loja" ON public.pets;
CREATE POLICY "staff le pets da loja"
  ON public.pets
  FOR SELECT
  TO authenticated
  USING (public.is_shop_staff(shop_id));

DROP POLICY IF EXISTS "staff le propria agenda" ON public.barber_schedule;
CREATE POLICY "staff le propria agenda"
  ON public.barber_schedule
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.barbers br
      WHERE br.id = barber_schedule.barber_id
        AND br.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "staff le reviews da loja" ON public.reviews;
CREATE POLICY "staff le reviews da loja"
  ON public.reviews
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.barbers br
      WHERE br.id = reviews.barber_id
        AND br.user_id = auth.uid()
    )
  );

-- Allow assignee staff to update status / complete attendance (execution), not shop-wide admin.
CREATE OR REPLACE FUNCTION public.update_booking_status(p_booking_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_shop_id UUID;
  v_client TEXT;
  v_pet TEXT;
BEGIN
  IF p_status NOT IN ('confirmed', 'in_progress', 'awaiting_payment', 'no_show', 'cancelled', 'scheduled') THEN
    RAISE EXCEPTION 'Status inválido';
  END IF;

  SELECT b.shop_id, b.client_name, p.name
  INTO v_shop_id, v_client, v_pet
  FROM bookings b
  LEFT JOIN pets p ON p.id = b.pet_id
  WHERE b.id = p_booking_id
  FOR UPDATE OF b;

  IF v_shop_id IS NULL THEN
    RAISE EXCEPTION 'Agendamento não encontrado';
  END IF;

  IF NOT (is_shop_owner(v_shop_id) OR is_booking_assignee(p_booking_id)) THEN
    RAISE EXCEPTION 'Sem permissão para atualizar este agendamento';
  END IF;

  UPDATE bookings SET status = p_status WHERE id = p_booking_id;

  IF p_status = 'no_show' THEN
    PERFORM notify_shop_owner(
      v_shop_id,
      'no_show',
      'Falta registrada',
      COALESCE(v_pet, v_client) || ' marcado como não compareceu.',
      p_booking_id
    );
  ELSIF p_status = 'cancelled' THEN
    PERFORM notify_shop_owner(
      v_shop_id,
      'booking_cancelled',
      'Agendamento cancelado',
      COALESCE(v_pet, v_client) || ' — horário liberado.',
      p_booking_id
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_booking(
  p_booking_id uuid,
  p_service_ids uuid[],
  p_payment_method text,
  p_amount numeric,
  p_customer_package_id uuid DEFAULT NULL::uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_shop_id UUID;
  v_client_name TEXT;
  v_client_id UUID;
  v_shop_customer_id UUID;
  v_client_phone TEXT;
  v_pet_name TEXT;
  v_phone_digits TEXT;
  v_allow_review BOOLEAN := false;
  v_customer_key TEXT;
BEGIN
  IF p_payment_method IS NULL OR p_payment_method NOT IN ('pix', 'cartao', 'dinheiro') THEN
    RAISE EXCEPTION 'Forma de pagamento inválida';
  END IF;

  IF p_service_ids IS NULL OR array_length(p_service_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Selecione ao menos um serviço';
  END IF;

  SELECT b.shop_id, b.client_name, b.client_id, b.shop_customer_id, b.client_phone, p.name
  INTO v_shop_id, v_client_name, v_client_id, v_shop_customer_id, v_client_phone, v_pet_name
  FROM bookings b
  LEFT JOIN pets p ON p.id = b.pet_id
  WHERE b.id = p_booking_id
  FOR UPDATE OF b;

  IF v_shop_id IS NULL THEN
    RAISE EXCEPTION 'Agendamento não encontrado';
  END IF;

  IF NOT (is_shop_owner(v_shop_id) OR is_booking_assignee(p_booking_id)) THEN
    RAISE EXCEPTION 'Sem permissão para finalizar este atendimento';
  END IF;

  v_phone_digits := regexp_replace(COALESCE(v_client_phone, ''), '[^0-9]', '', 'g');

  IF v_client_id IS NOT NULL THEN
    v_customer_key := 'c:' || v_client_id::text;
  ELSIF v_shop_customer_id IS NOT NULL THEN
    v_customer_key := 's:' || v_shop_customer_id::text;
  ELSIF length(v_phone_digits) >= 10 THEN
    v_customer_key := 'p:' || v_phone_digits;
  ELSE
    v_customer_key := NULL;
  END IF;

  IF v_customer_key IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM reviews r
      LEFT JOIN clients c ON c.id = r.client_id
      WHERE r.shop_id = v_shop_id
        AND (
          (v_client_id IS NOT NULL AND r.client_id = v_client_id)
          OR (
            length(v_phone_digits) >= 10
            AND regexp_replace(COALESCE(c.phone, ''), '[^0-9]', '', 'g') = v_phone_digits
          )
        )
    ) THEN
      v_allow_review := false;
    ELSIF EXISTS (
      SELECT 1
      FROM bookings earlier
      WHERE earlier.shop_id = v_shop_id
        AND earlier.id <> p_booking_id
        AND earlier.status = 'completed'
        AND (
          (v_client_id IS NOT NULL AND earlier.client_id = v_client_id)
          OR (v_shop_customer_id IS NOT NULL AND earlier.shop_customer_id = v_shop_customer_id)
          OR (
            length(v_phone_digits) >= 10
            AND regexp_replace(COALESCE(earlier.client_phone, ''), '[^0-9]', '', 'g') = v_phone_digits
          )
        )
    ) THEN
      v_allow_review := false;
    ELSE
      v_allow_review := true;
    END IF;
  END IF;

  UPDATE bookings
  SET
    status = 'completed',
    payment_method = p_payment_method,
    completed_at = now(),
    review_status = CASE
      WHEN v_allow_review THEN 'awaiting'
      ELSE 'unavailable'
    END
  WHERE id = p_booking_id;

  DELETE FROM booking_services WHERE booking_id = p_booking_id;

  INSERT INTO booking_services (booking_id, service_id)
  SELECT DISTINCT p_booking_id, sid
  FROM unnest(p_service_ids) AS sid;

  INSERT INTO financial_transactions (
    shop_id, booking_id, type, description, amount, payment_method
  ) VALUES (
    v_shop_id,
    p_booking_id,
    'entrada',
    'Atendimento - ' || COALESCE(v_pet_name || ' / ', '') || v_client_name,
    p_amount,
    p_payment_method
  );

  IF p_customer_package_id IS NOT NULL THEN
    PERFORM consume_package_session(p_customer_package_id, p_booking_id, 'Uso no atendimento');
  END IF;

  PERFORM notify_shop_owner(
    v_shop_id,
    'booking_completed',
    'Atendimento concluído',
    COALESCE(v_pet_name, v_client_name) || ' finalizado.',
    p_booking_id
  );
END;
$$;
