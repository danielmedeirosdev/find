-- FIND: Multi-tenant barbershop booking platform
-- Run this in Supabase SQL Editor

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE shops (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slogan TEXT,
  address TEXT,
  phone TEXT,
  hours_text TEXT,
  cpf_cnpj TEXT,
  asaas_customer_id TEXT,
  subscription_status TEXT NOT NULL DEFAULT 'trial'
    CHECK (subscription_status IN ('trial', 'active', 'blocked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0)
);

CREATE TABLE barbers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL
);

CREATE TABLE barber_schedule (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  barber_id UUID NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  is_active BOOLEAN NOT NULL DEFAULT true,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  CHECK (end_time > start_time),
  UNIQUE (barber_id, day_of_week)
);

CREATE TABLE clients (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  barber_id UUID NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  date DATE NOT NULL,
  time TIME NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (barber_id, date, time)
);

CREATE TABLE booking_services (
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  PRIMARY KEY (booking_id, service_id)
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_shops_owner ON shops(owner_user_id);
CREATE INDEX idx_shops_subscription ON shops(subscription_status);
CREATE INDEX idx_services_shop ON services(shop_id);
CREATE INDEX idx_barbers_shop ON barbers(shop_id);
CREATE INDEX idx_barber_schedule_barber ON barber_schedule(barber_id);
CREATE INDEX idx_bookings_shop ON bookings(shop_id);
CREATE INDEX idx_bookings_barber_date ON bookings(barber_id, date);
CREATE INDEX idx_bookings_client ON bookings(client_id);

-- ============================================================
-- HELPER: check if user owns a shop
-- ============================================================

CREATE OR REPLACE FUNCTION is_shop_owner(p_shop_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM shops
    WHERE id = p_shop_id AND owner_user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_barber_in_owned_shop(p_barber_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM barbers b
    JOIN shops s ON s.id = b.shop_id
    WHERE b.id = p_barber_id AND s.owner_user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE barbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE barber_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_services ENABLE ROW LEVEL SECURITY;

-- SHOPS
CREATE POLICY "Public can read active shops"
  ON shops FOR SELECT
  USING (subscription_status != 'blocked');

CREATE POLICY "Owners can read own shop"
  ON shops FOR SELECT
  USING (owner_user_id = auth.uid());

CREATE POLICY "Owners can insert own shop"
  ON shops FOR INSERT
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "Owners can update own shop"
  ON shops FOR UPDATE
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

-- SERVICES
CREATE POLICY "Public can read services of active shops"
  ON services FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM shops
      WHERE shops.id = services.shop_id
        AND shops.subscription_status != 'blocked'
    )
  );

CREATE POLICY "Owners manage own services"
  ON services FOR ALL
  USING (is_shop_owner(shop_id))
  WITH CHECK (is_shop_owner(shop_id));

-- BARBERS
CREATE POLICY "Public can read barbers of active shops"
  ON barbers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM shops
      WHERE shops.id = barbers.shop_id
        AND shops.subscription_status != 'blocked'
    )
  );

CREATE POLICY "Owners manage own barbers"
  ON barbers FOR ALL
  USING (is_shop_owner(shop_id))
  WITH CHECK (is_shop_owner(shop_id));

-- BARBER_SCHEDULE
CREATE POLICY "Public can read schedules of active shops"
  ON barber_schedule FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM barbers b
      JOIN shops s ON s.id = b.shop_id
      WHERE b.id = barber_schedule.barber_id
        AND s.subscription_status != 'blocked'
    )
  );

CREATE POLICY "Owners manage own barber schedules"
  ON barber_schedule FOR ALL
  USING (is_barber_in_owned_shop(barber_id))
  WITH CHECK (is_barber_in_owned_shop(barber_id));

-- CLIENTS
CREATE POLICY "Clients can read own profile"
  ON clients FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Clients can insert own profile"
  ON clients FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE POLICY "Clients can update own profile"
  ON clients FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- BOOKINGS
CREATE POLICY "Public can read bookings for availability"
  ON bookings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM shops
      WHERE shops.id = bookings.shop_id
        AND shops.subscription_status != 'blocked'
    )
  );

CREATE POLICY "Logged clients read own bookings"
  ON bookings FOR SELECT
  USING (client_id = auth.uid());

CREATE POLICY "Owners read own shop bookings"
  ON bookings FOR SELECT
  USING (is_shop_owner(shop_id));

CREATE POLICY "Anyone can create bookings on active shops"
  ON bookings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM shops
      WHERE shops.id = bookings.shop_id
        AND shops.subscription_status != 'blocked'
    )
    AND (
      client_id IS NULL
      OR client_id = auth.uid()
    )
  );

CREATE POLICY "Owners can update own shop bookings"
  ON bookings FOR UPDATE
  USING (is_shop_owner(shop_id))
  WITH CHECK (is_shop_owner(shop_id));

CREATE POLICY "Owners can delete own shop bookings"
  ON bookings FOR DELETE
  USING (is_shop_owner(shop_id));

-- BOOKING_SERVICES
CREATE POLICY "Public can read booking services"
  ON booking_services FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bookings bk
      JOIN shops s ON s.id = bk.shop_id
      WHERE bk.id = booking_services.booking_id
        AND s.subscription_status != 'blocked'
    )
  );

CREATE POLICY "Logged clients read own booking services"
  ON booking_services FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bookings bk
      WHERE bk.id = booking_services.booking_id
        AND bk.client_id = auth.uid()
    )
  );

CREATE POLICY "Owners read own booking services"
  ON booking_services FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bookings bk
      WHERE bk.id = booking_services.booking_id
        AND is_shop_owner(bk.shop_id)
    )
  );

CREATE POLICY "Anyone can insert booking services"
  ON booking_services FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bookings bk
      JOIN shops s ON s.id = bk.shop_id
      WHERE bk.id = booking_services.booking_id
        AND s.subscription_status != 'blocked'
    )
  );

CREATE POLICY "Owners manage own booking services"
  ON booking_services FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM bookings bk
      WHERE bk.id = booking_services.booking_id
        AND is_shop_owner(bk.shop_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bookings bk
      WHERE bk.id = booking_services.booking_id
        AND is_shop_owner(bk.shop_id)
    )
  );
