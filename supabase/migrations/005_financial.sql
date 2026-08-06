-- Gestão financeira e status de atendimentos

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'scheduled';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_status_check') THEN
    ALTER TABLE bookings ADD CONSTRAINT bookings_status_check
      CHECK (status IN ('scheduled', 'in_progress', 'completed', 'no_show', 'cancelled'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_payment_method_check') THEN
    ALTER TABLE bookings ADD CONSTRAINT bookings_payment_method_check
      CHECK (payment_method IN ('pix', 'cartao', 'dinheiro') OR payment_method IS NULL);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS financial_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES shops(id) ON DELETE CASCADE NOT NULL,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('entrada', 'saida')),
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  payment_method TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE barbers ADD COLUMN IF NOT EXISTS commission_percent NUMERIC;

ALTER TABLE financial_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dono gerencia financeiro" ON financial_transactions;
CREATE POLICY "dono gerencia financeiro" ON financial_transactions
  FOR ALL USING (
    shop_id IN (SELECT id FROM shops WHERE owner_user_id = auth.uid())
  );

NOTIFY pgrst, 'reload schema';
