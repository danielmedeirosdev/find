-- Descrição pública do estabelecimento (PET e demais verticais)
ALTER TABLE shops ADD COLUMN IF NOT EXISTS description TEXT;
