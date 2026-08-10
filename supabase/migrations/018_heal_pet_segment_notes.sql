-- Opcional: alinhar lojas cadastradas como PET via metadata/signup
-- que ainda estão com segment default 'barbershop'.
-- Rode no SQL Editor do Supabase do projeto de produção se necessário.

-- Exemplo: forçar uma loja específica para PET
-- UPDATE shops SET segment = 'pet' WHERE id = 'SEU-SHOP-ID';

-- Ou: lojas cujo nome sugere pet shop (revisar antes de aplicar em massa)
-- UPDATE shops
-- SET segment = 'pet'
-- WHERE segment IS DISTINCT FROM 'pet'
--   AND (
--     name ILIKE '%pet%'
--     OR name ILIKE '%banho%'
--     OR name ILIKE '%tosa%'
--   );
